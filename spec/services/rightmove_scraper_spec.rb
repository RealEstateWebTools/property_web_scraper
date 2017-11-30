require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Rightmove Scraper' do
    let(:import_url) { 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html' }
    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end

    it 'scrapes and save rightmove property page correctly' do
      VCR.use_cassette('scrapers/rightmove') do
        # import_url =
        web_scraper = PropertyWebScraper::Scraper.new('rightmove')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_properties = web_scraper.retrieve_and_save listing, 1
# byebug
        expect(retrieved_properties.for_rent).to eq(true)
        expect(retrieved_properties.reference).to eq("property-51775029")

                
        # expect(retrieved_properties.constructed_area).to eq(427)

        # expect(retrieved_properties.currency).to eq('EUR')
        # expect(retrieved_properties.price_string).to eq('147.000')
        # expect(retrieved_properties.price_float).to eq(147_000.0)
      end
    end
  end
end
