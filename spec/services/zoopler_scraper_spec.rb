require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Scraper' do
    it 'warns of non existent scraper' do
      expect { PropertyWebScraper::Scraper.new('dummy') }.to raise_error(ArgumentError)
    end
    it 'scrapes and save zoopla property page correctly' do
      VCR.use_cassette('scrapers/zoopla') do
        target_url = 'https://www.zoopla.co.uk/for-sale/details/43719239#yRkxcYIphFJYc139.97'


        web_scraper = PropertyWebScraper::Scraper.new('zoopla')
        retrieved_properties = web_scraper.retrieve_and_save target_url, 1
        # byebug


        expect(retrieved_properties.as_json['import_history']).not_to be_present
        # expect(retrieved_properties.as_json).not_to have_attributes("import_history")
        expect(retrieved_properties.reference).to eq('')
        expect(retrieved_properties.title).to eq('4 bed flat for sale')
        expect(retrieved_properties.constructed_area).to eq(2205)
        expect(retrieved_properties.currency).to eq("GBP")
        expect(retrieved_properties.area_unit).to eq("sqft")
        expect(retrieved_properties.address_string).to eq("38 St. Pauls Square, Birmingham B3")        
        expect(retrieved_properties.price_string).to eq("£875,000")
        expect(retrieved_properties.price_float).to eq(875000)

      end
    end
  end
end
