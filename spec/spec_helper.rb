# as per: https://www.viget.com/articles/rails-engine-testing-with-rspec-capybara-and-factorygirl
ENV['RAILS_ENV'] ||= 'test'
ENV['FIRESTORE_PROJECT_ID'] ||= 'test-project'

require File.expand_path('../dummy/config/environment.rb', __FILE__)
require 'rspec/rails'
require 'factory_bot_rails'

# http://www.thegreatcodeadventure.com/stubbing-with-vcr/
require 'vcr'
require 'webmock/rspec'
require 'climate_control'
WebMock.disable_net_connect!(allow_localhost: true)

Rails.backtrace_cleaner.remove_silencers!

# Load support files
Dir["#{File.dirname(__FILE__)}/support/**/*.rb"].each { |f| require f }

# Inject in-memory Firestore backend so tests run without the Java emulator.
PropertyWebScraper::FirestoreClient.instance_variable_set(:@client, InMemoryFirestore::Client.new)

RSpec.configure do |config|
  config.mock_with :rspec
  config.infer_base_class_for_anonymous_controllers = false
  config.order = 'random'
  config.include FactoryBot::Syntax::Methods

  config.fixture_paths = ["#{PropertyWebScraper::Engine.root}/spec/fixtures"]

  # Mirror the original cleanup: only clear the listings collection.
  # Shared contexts (e.g. import_hosts) manage their own lifecycle.
  config.after(:each) do
    client = PropertyWebScraper::FirestoreClient.client
    client.col('listings').list_documents.each { |doc| doc.delete }
  end
end
