# from root of engine:
# bundle exec rake app:property_web_scraper:db:seed     
# from spec/dummy folder or within an app using the engine:
# bundle exec rake property_web_scraper:db:seed
namespace :property_web_scraper do
  namespace :db do
    desc 'Seeds ImportHost records to associate url hosts with scraper configs.'
    task seed: [:environment] do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end

  end
end
