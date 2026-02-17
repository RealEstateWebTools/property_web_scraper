require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Cerdfw Scraper' do

    let(:import_url) { 'http://cerdfw.com/details/tx514_13729013--10080-Queens-Road-Frisco-TX-75035'}


    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end



    it 'scrapes and save cerdfw property page correctly' do
      VCR.use_cassette('scrapers/cerdfw') do
        # import_url =
        web_scraper = PropertyWebScraper::Scraper.new('cerdfw')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_property = web_scraper.retrieve_and_save listing, 1

        expect(retrieved_property.for_sale).to eq(true)
        expect(retrieved_property.image_urls.count).to eq(38)
        expect(retrieved_property.year_construction).to eq(1998)
        expect(retrieved_property.latitude).to eq(33.1470154308066)
        expect(retrieved_property.longitude).to eq(-96.7932415858605)
        expect(retrieved_property.currency).to eq("USD")
        expect(retrieved_property.price_string).to eq("$280,000")
        expect(retrieved_property.title).to eq("10080 Queens Road Frisco, TX 75035 — MLS# 13729013")


      end
    end
  end
end
