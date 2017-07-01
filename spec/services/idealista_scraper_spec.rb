require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Scraper' do
    it 'warns of non existent scraper' do
      expect { PropertyWebScraper::Scraper.new('dummy') }.to raise_error(ArgumentError)
    end


    it 'scrapes and save idealista property page correctly' do
      VCR.use_cassette('scrapers/idealista') do
        target_url = 'https://www.idealista.com/inmueble/30191362/'
        web_scraper = PropertyWebScraper::Scraper.new('idealista')
        retrieved_properties = web_scraper.retrieve_and_save target_url, 1
        expect(retrieved_properties.reference).to eq('30191362')
        expect(retrieved_properties.constructed_area).to eq(427)
        expect(retrieved_properties.currency).to eq("EUR")
        byebug


        
      end
    end
  end
end
