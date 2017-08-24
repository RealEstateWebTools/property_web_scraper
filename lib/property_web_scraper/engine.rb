require 'money-rails'
require 'jquery-rails'
require 'rack/cors'
# perhaps I had problems with bootstrap gem because I did not require it here

module PropertyWebScraper
  class Engine < ::Rails::Engine
    isolate_namespace PropertyWebScraper

    # Add a load path for this specific Engine
    # config.autoload_paths << File.expand_path("lib/some/path", __dir__)

    # initializer "my_engine.add_middleware" do |app|
    #   app.middleware.use MyEngine::Middleware
    # end

    config.generators do |g|
      g.test_framework :rspec, fixture: false
      g.fixture_replacement :factory_girl, dir: 'spec/factories'
      g.assets false
      g.helper false
    end
  end
end
