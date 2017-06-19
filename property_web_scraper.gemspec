$:.push File.expand_path("../lib", __FILE__)

# Maintain your gem's version:
require "property_web_scraper/version"

# Describe your gem and declare its dependencies:
Gem::Specification.new do |s|
  s.name        = "property_web_scraper"
  s.version     = PropertyWebScraper::VERSION
  s.authors     = ["Ed Tewiah"]
  s.email       = ["etewiah@hotmail.cim"]
  s.homepage    = "TODO"
  s.summary     = "TODO: Summary of PropertyWebScraper."
  s.description = "TODO: Description of PropertyWebScraper."
  s.license     = "MIT"

  s.files = Dir["{app,config,db,lib}/**/*", "MIT-LICENSE", "Rakefile", "README.md"]

  s.add_dependency "rails", "~> 5.0.3"

  s.add_development_dependency "pg"
end
