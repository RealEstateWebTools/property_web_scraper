require 'rack/cors'
require 'turbo-rails'
require 'stimulus-rails'

module PropertyWebScraper
  # Rails engine configuration for PropertyWebScraper.
  #
  # Isolates the engine namespace, registers asset precompilation paths,
  # and configures generators for RSpec and FactoryBot.
  class Engine < ::Rails::Engine
    isolate_namespace PropertyWebScraper

    # Add a load path for this specific Engine
    # config.autoload_paths << File.expand_path("lib/some/path", __dir__)

    # initializer "my_engine.add_middleware" do |app|
    #   app.middleware.use MyEngine::Middleware
    # end



    config.generators do |g|
      g.test_framework :rspec, fixture: false
      g.fixture_replacement :factory_bot, dir: 'spec/factories'
      g.assets false
      g.helper false
    end
  end
end
