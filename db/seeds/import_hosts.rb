# load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
import_hosts_data_array = [
  { slug: 'us_mlslistings', scraper_name: 'us_mlslistings', host: 'www.mlslistings.com' },
  { slug: 'us_realtor', scraper_name: 'us_realtor', host: 'www.realtor.com' },
  { slug: 'es_idealista', scraper_name: 'es_idealista', host: 'www.idealista.com' },
  { slug: 'uk_rightmove', scraper_name: 'uk_rightmove', host: 'www.rightmove.co.uk' },
  { slug: 'uk_zoopla', scraper_name: 'uk_zoopla', host: 'www.zoopla.co.uk' },
  { slug: 'it_carusoimmobiliare', scraper_name: 'it_carusoimmobiliare', host: 'www.carusoimmobiliare.it' },
  { slug: 'us_wyomingmls', scraper_name: 'us_wyomingmls', host: 'www.wyomingmls.com' },
  { slug: 'us_forsalebyowner', scraper_name: 'us_forsalebyowner', host: 'www.forsalebyowner.com' },
  { slug: 'us_cerdfw', scraper_name: 'us_cerdfw', host: 'cerdfw.com' },
  { slug: 'in_realestateindia', scraper_name: 'in_realestateindia', host: 'www.realestateindia.com' },
  { slug: 'es_fotocasa', scraper_name: 'es_fotocasa', host: 'www.fotocasa.es' },
  { slug: 'es_pisos', scraper_name: 'es_pisos', host: 'www.pisos.com' },
  { slug: 'es_inmo1', scraper_name: 'es_inmo1', host: 'www.inmo1.com' },
  { slug: 'uk_jitty', scraper_name: 'uk_jitty', host: 'www.jitty.com' },
  { slug: 'uk_onthemarket', scraper_name: 'uk_onthemarket', host: 'www.onthemarket.com' },
  { slug: 'ie_daft', scraper_name: 'ie_daft', host: 'www.daft.ie' },
  { slug: 'es_weebrix', scraper_name: 'es_weebrix', host: 'www.weebrix.com' },
]
# when above is updated, will also have to add scraper_name to list in scraper_mapping model

import_hosts_data_array.each do |import_host_data|
  unless PropertyWebScraper::ImportHost.exists?(host: import_host_data[:host])
    PropertyWebScraper::ImportHost.create!(import_host_data)
  end
end
