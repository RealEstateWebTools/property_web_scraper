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
        retrieved_property = web_scraper.retrieve_and_save listing, 1

        expect(retrieved_property.for_rent).to eq(true)

        expect(retrieved_property.longitude).to eq(-1.8683744229091472)
        expect(retrieved_property.latitude).to eq(52.413249369181294)
        expect(retrieved_property.postal_code).to eq("B14 4JP")
        expect(retrieved_property.reference).to eq("51775029")
        expect(retrieved_property.image_urls[0]).to eq("http://media.rightmove.co.uk/dir/147k/146672/51775029/146672_87_School_Rd_IMG_00_0000.jpg")
        expect(retrieved_property.title).to eq("4 bedroom detached house to rent in School Road, Birmingham, B14, B14")
        expect(retrieved_property.address_string).to eq("School Road, Birmingham, B14")
        expect(retrieved_property.currency).to eq('GBP')
        expect(retrieved_property.price_string).to eq('£995 pcm')
        expect(retrieved_property.price_float).to eq(995.0)
      end
    end
  end
end
