# as per: https://www.viget.com/articles/rails-engine-testing-with-rspec-capybara-and-factorygirl
ENV['RAILS_ENV'] ||= 'test'

require File.expand_path("../dummy/config/environment.rb", __FILE__)
require 'rspec/rails'
require 'rspec/autorun'
require 'factory_girl_rails'

# http://www.thegreatcodeadventure.com/stubbing-with-vcr/
require 'vcr'
require 'webmock/rspec'
WebMock.disable_net_connect!(allow_localhost: true)

Rails.backtrace_cleaner.remove_silencers!

# Load support files
Dir["#{File.dirname(__FILE__)}/support/**/*.rb"].each { |f| require f }

RSpec.configure do |config|
 config.mock_with :rspec
 config.use_transactional_fixtures = true
 config.infer_base_class_for_anonymous_controllers = false
 config.order = "random"
end

