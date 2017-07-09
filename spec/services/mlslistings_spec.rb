require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Scraper' do
    it 'scrapes and save mlslistings property page correctly' do
      VCR.use_cassette('scrapers/mlslistings') do
        import_url = 'http://www.mlslistings.com/property/ml81643266/1547-desdemona-ct-san-jose-ca-95121/'

        web_scraper = PropertyWebScraper::Scraper.new('mlslistings')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_properties = web_scraper.retrieve_and_save listing, 1

        expect(retrieved_properties.reference).to eq('ML81643266')
        expect(retrieved_properties.main_image_url).to eq('http://data.mlslistings.com/GetMedia.ashx?Q=RmlsZUlEPTM5NjkwMTI5NQ%3d%3d&Hash=5a5ff2643e30251129add44affeb7455')
        expect(retrieved_properties.longitude).to eq(-121.8234990)
        expect(retrieved_properties.title).to eq("1547 Desdemona CT, SAN JOSE, CA 95121 ( For Sale )")
        expect(retrieved_properties.constructed_area).to eq(1176)
        expect(retrieved_properties.currency).to eq("USD")
        expect(retrieved_properties.price_string).to eq("$489,000")
        expect(retrieved_properties.price_float).to eq(489000.0)

      end
    end
  end
end
