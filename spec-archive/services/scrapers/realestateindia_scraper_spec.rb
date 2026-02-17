require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Realestateindia Scraper' do

    let(:import_url) { 'https://www.realestateindia.com/property-detail/residential-flats-apartments/rent/2-bedrooms-in-andheri-west-mumbai-maharashtra-712907.htm'}

    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end

    it 'scrapes and save realestateindia property page correctly' do
      VCR.use_cassette('scrapers/realestateindia') do
        # import_url =
        web_scraper = PropertyWebScraper::Scraper.new('realestateindia')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_property = web_scraper.retrieve_and_save listing, 1

        # expect(retrieved_property.for_rent).to eq(false)
      end
    end
  end
end
