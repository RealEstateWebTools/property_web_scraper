RSpec.shared_context 'with seeded import hosts' do
  before :all do
    load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
  end
end
