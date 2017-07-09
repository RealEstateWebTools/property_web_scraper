require 'money-rails'
require 'jquery-rails'
# perhaps I had problems with bootstrap gem because I did not require it here

module PropertyWebScraper
  class Engine < ::Rails::Engine
    isolate_namespace PropertyWebScraper

    config.generators do |g|
      g.test_framework :rspec, fixture: false
      g.fixture_replacement :factory_girl, dir: 'spec/factories'
      g.assets false
      g.helper false
    end
  end
end
