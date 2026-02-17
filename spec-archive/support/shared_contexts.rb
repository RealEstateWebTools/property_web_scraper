RSpec.shared_context 'with seeded import hosts' do
  before :all do
    load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
  end

  after :all do
    client = PropertyWebScraper::FirestoreClient.client
    client.col('import_hosts').list_documents.each { |doc| doc.delete }
  end
end
