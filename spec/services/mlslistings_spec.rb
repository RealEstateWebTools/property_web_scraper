require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Scraper' do
    it 'scrapes and save mlslistings property page correctly' do
      VCR.use_cassette('scrapers/mlslistings') do
        target_url = 'http://www.mlslistings.com/property/ml81643266/1547-desdemona-ct-san-jose-ca-95121/'

        web_scraper = PropertyWebScraper::Scraper.new('mlslistings')
        retrieved_properties = web_scraper.retrieve_and_save target_url, 1

        expect(retrieved_properties.reference).to eq('ML81643266')
        expect(retrieved_properties.constructed_area).to eq(1.176)
      end
    end
  end
end
