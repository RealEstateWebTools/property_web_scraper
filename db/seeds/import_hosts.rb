# load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
PropertyWebScraper::ImportHost.create!(
  [
    {scraper_name: "mlslistings", host: "www.mlslistings.com"},
])
