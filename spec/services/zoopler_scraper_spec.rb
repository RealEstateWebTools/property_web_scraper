require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Zoopler Scraper' do
    let(:import_url) {'https://www.zoopla.co.uk/for-sale/details/43719239#yRkxcYIphFJYc139.97'}
    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end

    it 'scrapes and save zoopla property page correctly' do
      VCR.use_cassette('scrapers/zoopla') do
        # import_url = 'https://www.zoopla.co.uk/for-sale/details/43719239#yRkxcYIphFJYc139.97'
        web_scraper = PropertyWebScraper::Scraper.new('zoopla')

        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_properties = web_scraper.retrieve_and_save listing, 1

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
