require_relative 'boot'

# Pick the frameworks you want:
require 'action_controller/railtie'
require 'action_view/railtie'
require 'action_mailer/railtie'
require 'active_job/railtie'
require 'action_cable/engine'
# require "rails/test_unit/railtie"
require 'sprockets/railtie'

Bundler.require(*Rails.groups)
require 'property_web_scraper'

module Dummy
  class Application < Rails::Application
    config.load_defaults 7.2
  end
end
