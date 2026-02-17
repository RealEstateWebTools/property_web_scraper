require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Pwb Scraper' do

    let(:import_url) { 'http://www.laventa-mallorca.com/en/properties/for-sale/71/chalet-in-cala-blava-llucmajor' }
    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end

    it 'scrapes and save pwb property page correctly' do
      VCR.use_cassette('scrapers/pwb') do
        # import_url =
        web_scraper = PropertyWebScraper::Scraper.new('pwb')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_property = web_scraper.retrieve_and_save listing, 1

        expect(retrieved_property.for_rent).to eq(false)


        expect(retrieved_property.longitude).to eq(2.73674249999999,)
        expect(retrieved_property.latitude).to eq(39.4828874)
        expect(retrieved_property.reference).to eq("Gu_001")
        # expect(retrieved_property.image_urls[0]).to eq("http://media.pwb.co.uk/dir/147k/146672/51775029/146672_87_School_Rd_IMG_00_0000.jpg")
        expect(retrieved_property.title).to eq("Chalet in Cala Blava / Llucmajor")
        # expect(retrieved_property.address_string).to eq("School Road, Birmingham, B14")
        expect(retrieved_property.currency).to eq('EUR')
        # expect(retrieved_property.price_string).to eq('£995 pcm')
        # expect(retrieved_property.price_float).to eq(995.0)
      end
    end
  end
end
