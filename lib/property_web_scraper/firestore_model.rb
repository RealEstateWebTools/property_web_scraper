require 'active_model'

module PropertyWebScraper
  # ActiveModel-based module providing an ActiveRecord-compatible API
  # backed by Google Cloud Firestore.
  #
  # Include this module in a plain Ruby class and call +firestore_collection+
  # to declare the Firestore collection name. Declare attributes with
  # +attribute+ to define typed fields with defaults.
  #
  # @example
  #   class MyModel
  #     include PropertyWebScraper::FirestoreModel
  #     firestore_collection :my_models
  #     attribute :name, :string
  #     attribute :count, :integer, default: 0
  #   end
  module FirestoreModel
    extend ActiveSupport::Concern

    included do
      include ActiveModel::Model
      include ActiveModel::Validations
      include ActiveModel::Serialization

      class_attribute :_collection_name, instance_writer: false
      class_attribute :_attribute_definitions, instance_writer: false, default: {}
      class_attribute :_document_id_field, instance_writer: false

      attr_accessor :id

      # Override methods after ActiveModel::API so our versions take
      # precedence in the MRO.
      define_method(:initialize) do |attrs = {}|
        @persisted = false
        apply_defaults
        super(attrs)
      end

      define_method(:persisted?) do
        @persisted
      end

      define_method(:new_record?) do
        !persisted?
      end
    end

    class_methods do
      def firestore_collection(name)
        self._collection_name = name.to_s
      end

      def document_id_field(field_name)
        self._document_id_field = field_name.to_s
      end

      def attribute(name, type = :string, **options)
        self._attribute_definitions = _attribute_definitions.merge(
          name.to_s => { type: type, default: options[:default] }
        )
        attr_accessor name
      end

      def collection_ref
        prefix = ENV.fetch('FIRESTORE_COLLECTION_PREFIX', '')
        FirestoreClient.client.col("#{prefix}#{_collection_name}")
      end

      def find(id)
        doc = collection_ref.doc(id.to_s).get
        raise "Document not found: #{id}" unless doc.exists?
        build_from_snapshot(doc)
      end

      def find_by(conditions)
        query = collection_ref
        conditions.each do |field, value|
          query = query.where(field.to_s, :==, value)
        end
        docs = query.get
        doc = docs.first
        return nil unless doc
        build_from_snapshot(doc)
      end

      def where(conditions)
        WhereChain.new(self, conditions)
      end

      def exists?(conditions)
        !find_by(conditions).nil?
      end

      def create!(attrs = {})
        instance = new(attrs)
        instance.save!
        instance
      end

      def method_missing(method_name, *args, &block)
        if method_name.to_s.start_with?('find_by_')
          field = method_name.to_s.sub('find_by_', '')
          find_by(field => args.first)
        else
          super
        end
      end

      def respond_to_missing?(method_name, include_private = false)
        method_name.to_s.start_with?('find_by_') || super
      end

      def build_from_snapshot(doc)
        attrs = doc.data.transform_keys(&:to_s)
        instance = new
        instance.id = doc.document_id
        instance._assign_attributes_from_firestore(attrs)
        instance.instance_variable_set(:@persisted, true)
        instance
      end
    end

    def save!
      validate!
      data = firestore_attributes
      if persisted?
        collection_ref.doc(id).set(data)
      else
        if self.class._document_id_field
          doc_id = send(self.class._document_id_field).to_s
          self.id = doc_id
          collection_ref.doc(doc_id).set(data)
        else
          doc_ref = collection_ref.doc
          self.id = doc_ref.document_id
          doc_ref.set(data)
        end
        @persisted = true
      end
      _assign_attributes_from_firestore(data.transform_keys(&:to_s))
      self
    end

    def validate!
      unless valid?
        raise ActiveModel::ValidationError, self
      end
    end

    def reload
      raise "Cannot reload a new record" unless persisted?
      doc = collection_ref.doc(id).get
      raise "Document not found: #{id}" unless doc.exists?
      attrs = doc.data.transform_keys(&:to_s)
      _assign_attributes_from_firestore(attrs)
      self
    end

    def destroy
      return unless persisted?
      collection_ref.doc(id).delete
      @persisted = false
      self
    end

    def update_column(name, value)
      raise "Cannot update_column on a new record" unless persisted?
      send("#{name}=", value)
      collection_ref.doc(id).update({ name.to_s => value })
    end

    def [](key)
      send(key)
    end

    def []=(key, value)
      send("#{key}=", value)
    end

    def as_json(options = nil)
      options ||= {}
      attrs = firestore_attributes

      if options[:only]
        only_keys = options[:only].map(&:to_s)
        attrs = attrs.select { |k, _| only_keys.include?(k) }
      end

      if options[:methods]
        options[:methods].each do |method_name|
          attrs[method_name.to_s] = send(method_name) if respond_to?(method_name)
        end
      end

      attrs
    end

    def _assign_attributes_from_firestore(attrs)
      self.class._attribute_definitions.each do |name, defn|
        raw = attrs.key?(name) ? attrs[name] : defn[:default]
        value = cast_value(raw, defn[:type])
        send("#{name}=", value)
      end
    end

    private

    def apply_defaults
      self.class._attribute_definitions.each do |name, defn|
        default = defn[:default]
        value = default.is_a?(Proc) ? default.call : default
        send("#{name}=", value)
      end
    end

    def firestore_attributes
      attrs = {}
      self.class._attribute_definitions.each_key do |name|
        attrs[name] = send(name)
      end
      attrs
    end

    def collection_ref
      self.class.collection_ref
    end

    def cast_value(value, type)
      return value if value.nil?
      case type
      when :string
        value.to_s
      when :integer
        value.to_i
      when :float
        value.to_f
      when :boolean
        !!value
      when :datetime
        case value
        when Time, DateTime then value
        when Google::Cloud::Firestore::Convert then value
        when String then Time.parse(value)
        else value
        end
      when :array
        value.is_a?(Array) ? value : [value]
      when :hash, :json
        value.is_a?(Hash) ? value : {}
      else
        value
      end
    end

    # Chainable query builder for Firestore queries.
    class WhereChain
      def initialize(klass, conditions)
        @klass = klass
        @conditions = conditions
      end

      def first
        query = @klass.collection_ref
        @conditions.each do |field, value|
          query = query.where(field.to_s, :==, value)
        end
        doc = query.get.first
        return nil unless doc
        @klass.build_from_snapshot(doc)
      end

      def first_or_create(attrs = {})
        existing = first
        return existing if existing

        # Use a transaction to prevent duplicates from race conditions
        FirestoreClient.client.transaction do |_tx|
          query = @klass.collection_ref
          @conditions.each do |field, value|
            query = query.where(field.to_s, :==, value)
          end
          doc = query.get.first
          if doc
            @klass.build_from_snapshot(doc)
          else
            @klass.create!(@conditions.merge(attrs))
          end
        end
      end

      def get
        query = @klass.collection_ref
        @conditions.each do |field, value|
          query = query.where(field.to_s, :==, value)
        end
        query.get.map { |doc| @klass.build_from_snapshot(doc) }
      end

      def delete_all
        query = @klass.collection_ref
        @conditions.each do |field, value|
          query = query.where(field.to_s, :==, value)
        end
        query.get.each { |doc| doc.ref.delete }
      end
    end
  end
end
