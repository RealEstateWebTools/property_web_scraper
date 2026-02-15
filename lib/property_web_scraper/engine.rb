require 'money-rails'
require 'rack/cors'

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

    initializer "property_web_scraper.assets.precompile" do |app|
      app.config.assets.precompile += %w( property_web_scraper/spp_vuetify.css property_web_scraper/spp_vuetify.js )
    end
    # seems above is the preferred way of setting up precompilation in an engine
    # http://edgeguides.rubyonrails.org/engines.html#separate-assets-precompiling
    # config.assets.precompile += %w( property_web_scraper/spp_vuetify.css property_web_scraper/spp_vuetify.js )


    config.generators do |g|
      g.test_framework :rspec, fixture: false
      g.fixture_replacement :factory_bot, dir: 'spec/factories'
      g.assets false
      g.helper false
    end
  end
end
