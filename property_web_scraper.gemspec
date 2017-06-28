$:.push File.expand_path("../lib", __FILE__)

# Maintain your gem's version:
require "property_web_scraper/version"

# Describe your gem and declare its dependencies:
Gem::Specification.new do |s|
  s.name        = "property_web_scraper"
  s.version     = PropertyWebScraper::VERSION
  s.authors     = ["Ed Tewiah"]
  s.email       = ["etewiah@hotmail.cim"]
  s.homepage    = ""
  s.summary     = "Web based UI to make scraping data from real estate websites super simple."
  s.description = "PropertyWebScraper makes it easy for anyone to scrape data from real estate websites."
  s.license     = "MIT"

  s.files = Dir["{app,config,db,lib}/**/*", "MIT-LICENSE", "Rakefile", "README.md"]
  s.test_files = Dir["spec/**/*"]

  s.add_dependency "rails", ">= 5.0.0"
  s.add_dependency 'nokogiri'
  s.add_dependency 'faraday'
  s.add_dependency 'active_hash'

  s.add_development_dependency 'byebug'
  s.add_development_dependency 'pry'

  s.add_development_dependency "pg"

  s.add_development_dependency 'rspec-rails'
  s.add_development_dependency 'capybara'
  s.add_development_dependency 'factory_girl_rails'

end
