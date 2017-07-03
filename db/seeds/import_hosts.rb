# load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
import_hosts_data_array = [
  { scraper_name: 'mlslistings', host: 'www.mlslistings.com' },
  { scraper_name: 'realtor', host: 'www.realtor.com' },
  { scraper_name: 'idealista', host: 'www.idealista.com' },
  { scraper_name: 'zoopla', host: 'www.zoopla.com' }
]

import_hosts_data_array.each do |import_host_data|
  unless PropertyWebScraper::ImportHost.exists?(host: import_host_data[:host])
    PropertyWebScraper::ImportHost.create!(import_host_data)
  end
end
