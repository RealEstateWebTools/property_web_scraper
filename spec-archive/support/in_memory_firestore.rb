# Lightweight in-memory implementation of the Google::Cloud::Firestore API
# surface used by FirestoreModel. Eliminates the need for Java / the
# Firestore emulator in tests.
module InMemoryFirestore
  # Shared mutable store: { collection_name => { doc_id => Hash } }
  @store = {}

  class << self
    attr_accessor :store

    def reset!
      @store = {}
    end
  end

  # ── Client ──────────────────────────────────────────────────────────
  class Client
    def col(name)
      CollectionReference.new(name.to_s)
    end

    def transaction
      yield self
    end
  end

  # ── CollectionReference ─────────────────────────────────────────────
  class CollectionReference
    attr_reader :name

    def initialize(name)
      @name = name
    end

    def doc(id = nil)
      id = id&.to_s || SecureRandom.hex(10)
      DocumentReference.new(@name, id)
    end

    def where(field, operator, value)
      Query.new(@name, [[field.to_s, operator, value]])
    end

    def list_documents
      store = InMemoryFirestore.store[@name] || {}
      store.keys.map { |id| DocumentReference.new(@name, id) }
    end
  end

  # ── DocumentReference ───────────────────────────────────────────────
  class DocumentReference
    attr_reader :document_id

    def initialize(collection_name, id)
      @collection_name = collection_name
      @document_id = id
    end

    def get
      data = collection_store[@document_id]
      DocumentSnapshot.new(@collection_name, @document_id, data)
    end

    def set(data)
      InMemoryFirestore.store[@collection_name] ||= {}
      InMemoryFirestore.store[@collection_name][@document_id] = deep_copy(data)
    end

    def update(data)
      InMemoryFirestore.store[@collection_name] ||= {}
      existing = InMemoryFirestore.store[@collection_name][@document_id] || {}
      InMemoryFirestore.store[@collection_name][@document_id] = existing.merge(deep_copy(data))
    end

    def delete
      InMemoryFirestore.store[@collection_name]&.delete(@document_id)
    end

    private

    def collection_store
      InMemoryFirestore.store[@collection_name] || {}
    end

    def deep_copy(obj)
      Marshal.load(Marshal.dump(obj))
    end
  end

  # ── DocumentSnapshot ────────────────────────────────────────────────
  class DocumentSnapshot
    attr_reader :document_id, :data

    def initialize(collection_name, id, data)
      @collection_name = collection_name
      @document_id = id
      @data = data
    end

    def exists?
      !@data.nil?
    end

    def ref
      DocumentReference.new(@collection_name, @document_id)
    end
  end

  # ── Query (chainable where) ─────────────────────────────────────────
  class Query
    def initialize(collection_name, conditions)
      @collection_name = collection_name
      @conditions = conditions
    end

    def where(field, operator, value)
      Query.new(@collection_name, @conditions + [[field.to_s, operator, value]])
    end

    def get
      store = InMemoryFirestore.store[@collection_name] || {}
      store.select { |_id, doc_data|
        @conditions.all? { |field, _op, value|
          doc_data[field.to_s] == value
        }
      }.map { |id, doc_data|
        DocumentSnapshot.new(@collection_name, id, doc_data)
      }
    end
  end
end
