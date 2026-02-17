require 'spec_helper'

# Lightweight inline model used exclusively for testing FirestoreModel.
# Uses a dedicated `_test_models` collection so it never collides with
# production data or the global after(:each) cleanup in spec_helper.
class TestModel
  include PropertyWebScraper::FirestoreModel

  firestore_collection :_test_models

  attribute :name, :string
  attribute :count, :integer, default: 0
  attribute :score, :float, default: 0.0
  attribute :active, :boolean, default: true
  attribute :tags, :array, default: []
  attribute :metadata, :hash, default: {}

  validates :name, presence: true
end

class TestModelWithDocId
  include PropertyWebScraper::FirestoreModel

  firestore_collection :_test_models_doc_id

  attribute :slug, :string
  attribute :label, :string

  document_id_field :slug
end

RSpec.describe PropertyWebScraper::FirestoreModel do
  after(:each) do
    client = PropertyWebScraper::FirestoreClient.client
    client.col('_test_models').list_documents.each { |doc| doc.delete }
    client.col('_test_models_doc_id').list_documents.each { |doc| doc.delete }
  end

  # ---------- Attribute defaults ----------

  describe 'attribute defaults' do
    it 'applies declared defaults on initialize' do
      m = TestModel.new(name: 'test')
      expect(m.count).to eq(0)
      expect(m.score).to eq(0.0)
      expect(m.active).to eq(true)
      expect(m.tags).to eq([])
      expect(m.metadata).to eq({})
    end

    it 'returns nil for attributes without a default' do
      m = TestModel.new
      expect(m.name).to be_nil
    end
  end

  # ---------- Persistence ----------

  describe 'persistence' do
    it 'starts as a new record' do
      m = TestModel.new(name: 'test')
      expect(m.new_record?).to be true
      expect(m.persisted?).to be false
    end

    it 'marks as persisted after save!' do
      m = TestModel.new(name: 'test')
      m.save!
      expect(m.persisted?).to be true
      expect(m.new_record?).to be false
      expect(m.id).not_to be_nil
    end
  end

  # ---------- CRUD ----------

  describe 'CRUD operations' do
    describe '.create!' do
      it 'creates and persists a record' do
        m = TestModel.create!(name: 'created')
        expect(m.persisted?).to be true
        expect(m.id).not_to be_nil

        found = TestModel.find(m.id)
        expect(found.name).to eq('created')
      end
    end

    describe '.find' do
      it 'retrieves a record by id' do
        m = TestModel.create!(name: 'findme')
        found = TestModel.find(m.id)
        expect(found.name).to eq('findme')
        expect(found.id).to eq(m.id)
      end

      it 'raises when the document does not exist' do
        expect { TestModel.find('nonexistent_id') }.to raise_error(/Document not found/)
      end
    end

    describe '.find_by' do
      it 'returns the first matching record' do
        TestModel.create!(name: 'alice', count: 5)
        TestModel.create!(name: 'bob', count: 10)

        found = TestModel.find_by(name: 'bob')
        expect(found).not_to be_nil
        expect(found.name).to eq('bob')
      end

      it 'returns nil when nothing matches' do
        expect(TestModel.find_by(name: 'ghost')).to be_nil
      end
    end

    describe '#reload' do
      it 'refreshes attributes from Firestore' do
        m = TestModel.create!(name: 'original')
        # Update directly in Firestore behind the model's back
        TestModel.collection_ref.doc(m.id).update({ 'name' => 'updated' })

        m.reload
        expect(m.name).to eq('updated')
      end

      it 'raises on a new record' do
        m = TestModel.new(name: 'new')
        expect { m.reload }.to raise_error(/Cannot reload/)
      end
    end

    describe '#destroy' do
      it 'deletes the document and marks as not persisted' do
        m = TestModel.create!(name: 'doomed')
        id = m.id
        m.destroy

        expect(m.persisted?).to be false
        expect { TestModel.find(id) }.to raise_error(/Document not found/)
      end
    end
  end

  # ---------- Custom document ID ----------

  describe 'document_id_field' do
    it 'uses the specified field as the Firestore document ID' do
      m = TestModelWithDocId.create!(slug: 'my-slug', label: 'My Label')
      expect(m.id).to eq('my-slug')

      found = TestModelWithDocId.find('my-slug')
      expect(found.label).to eq('My Label')
    end
  end

  # ---------- Bracket access ----------

  describe '[] and []= accessors' do
    it 'reads attributes with []' do
      m = TestModel.new(name: 'bracket')
      expect(m[:name]).to eq('bracket')
    end

    it 'writes attributes with []=' do
      m = TestModel.new(name: 'old')
      m[:name] = 'new'
      expect(m.name).to eq('new')
    end
  end

  # ---------- Dynamic finders ----------

  describe 'dynamic find_by_* finders' do
    it 'delegates find_by_name to find_by' do
      TestModel.create!(name: 'dynamic')
      found = TestModel.find_by_name('dynamic')
      expect(found).not_to be_nil
      expect(found.name).to eq('dynamic')
    end

    it 'responds to find_by_* methods' do
      expect(TestModel).to respond_to(:find_by_name)
    end
  end

  # ---------- where queries ----------

  describe '.where' do
    before do
      TestModel.create!(name: 'alpha', count: 1)
      TestModel.create!(name: 'beta', count: 2)
      TestModel.create!(name: 'alpha', count: 3)
    end

    describe '#first' do
      it 'returns the first matching record' do
        result = TestModel.where(name: 'beta').first
        expect(result).not_to be_nil
        expect(result.name).to eq('beta')
      end

      it 'returns nil when nothing matches' do
        expect(TestModel.where(name: 'gamma').first).to be_nil
      end
    end

    describe '#first_or_create' do
      it 'returns existing record when found' do
        existing = TestModel.where(name: 'beta').first_or_create(count: 99)
        expect(existing.name).to eq('beta')
        expect(existing.count).to eq(2)
      end

      it 'creates a new record when not found' do
        created = TestModel.where(name: 'gamma').first_or_create(count: 42)
        expect(created.persisted?).to be true
        expect(created.name).to eq('gamma')
        expect(created.count).to eq(42)
      end
    end

    describe '#get' do
      it 'returns all matching records' do
        results = TestModel.where(name: 'alpha').get
        expect(results.length).to eq(2)
        expect(results.map(&:name)).to all(eq('alpha'))
      end
    end

    describe '#delete_all' do
      it 'deletes all matching documents' do
        TestModel.where(name: 'alpha').delete_all
        expect(TestModel.find_by(name: 'alpha')).to be_nil
        # beta should remain
        expect(TestModel.find_by(name: 'beta')).not_to be_nil
      end
    end
  end

  # ---------- exists? ----------

  describe '.exists?' do
    it 'returns true when a matching record exists' do
      TestModel.create!(name: 'present')
      expect(TestModel.exists?(name: 'present')).to be true
    end

    it 'returns false when no match exists' do
      expect(TestModel.exists?(name: 'absent')).to be false
    end
  end

  # ---------- Validation ----------

  describe 'validation' do
    it 'raises ActiveModel::ValidationError on save! when invalid' do
      m = TestModel.new # name is nil, fails presence validation
      expect { m.save! }.to raise_error(ActiveModel::ValidationError)
    end
  end

  # ---------- as_json ----------

  describe '#as_json' do
    it 'returns all attributes by default' do
      m = TestModel.new(name: 'json', count: 5)
      json = m.as_json
      expect(json).to include('name' => 'json', 'count' => 5)
    end

    it 'respects :only option' do
      m = TestModel.new(name: 'json', count: 5, score: 1.5)
      json = m.as_json(only: [:name])
      expect(json.keys).to eq(['name'])
    end

    it 'respects :methods option' do
      m = TestModel.new(name: 'json')
      json = m.as_json(methods: [:persisted?])
      expect(json).to have_key('persisted?')
      expect(json['persisted?']).to eq(false)
    end
  end

  # ---------- Type casting ----------

  describe 'type casting' do
    it 'casts integer attributes' do
      m = TestModel.create!(name: 'cast', count: '7')
      found = TestModel.find(m.id)
      expect(found.count).to eq(7)
      expect(found.count).to be_a(Integer)
    end

    it 'casts float attributes' do
      m = TestModel.create!(name: 'cast', score: '3.14')
      found = TestModel.find(m.id)
      expect(found.score).to eq(3.14)
      expect(found.score).to be_a(Float)
    end

    it 'casts boolean attributes' do
      m = TestModel.create!(name: 'cast', active: false)
      found = TestModel.find(m.id)
      expect(found.active).to eq(false)
    end

    it 'casts array attributes' do
      m = TestModel.create!(name: 'cast', tags: ['a', 'b'])
      found = TestModel.find(m.id)
      expect(found.tags).to eq(['a', 'b'])
      expect(found.tags).to be_a(Array)
    end

    it 'casts hash attributes' do
      m = TestModel.create!(name: 'cast', metadata: { 'key' => 'val' })
      found = TestModel.find(m.id)
      expect(found.metadata).to eq({ 'key' => 'val' })
      expect(found.metadata).to be_a(Hash)
    end
  end

  # ---------- update_column ----------

  describe '#update_column' do
    it 'updates a single field in-place' do
      m = TestModel.create!(name: 'before')
      m.update_column(:name, 'after')

      expect(m.name).to eq('after')

      found = TestModel.find(m.id)
      expect(found.name).to eq('after')
    end

    it 'raises on a new record' do
      m = TestModel.new(name: 'new')
      expect { m.update_column(:name, 'x') }.to raise_error(/Cannot update_column/)
    end
  end
end
