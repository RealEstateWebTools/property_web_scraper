# load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
import_hosts_data_array = [
  { slug: 'mlslistings', scraper_name: 'mlslistings', host: 'www.mlslistings.com' },
  { slug: 'realtor', scraper_name: 'realtor', host: 'www.realtor.com' },
  { slug: 'idealista', scraper_name: 'idealista', host: 'www.idealista.com' },
  { slug: 'rightmove', scraper_name: 'rightmove', host: 'www.rightmove.co.uk' },
  { slug: 'example', scraper_name: 'default', host: 'www.example.co.uk' },
  { slug: 'laventa', scraper_name: 'pwb', host: 'www.laventa-mallorca.com' },
  { slug: 'zoopla', scraper_name: 'zoopla', host: 'www.zoopla.co.uk' },
  { slug: 'wyomingmls', scraper_name: 'wyomingmls', host: 'www.wyomingmls.com' },
]

import_hosts_data_array.each do |import_host_data|
  unless PropertyWebScraper::ImportHost.exists?(host: import_host_data[:host])
    PropertyWebScraper::ImportHost.create!(import_host_data)
  end
end
