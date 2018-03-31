require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Inmo1 Scraper' do

    let(:import_url) { 'http://re-renting.com/en/properties/for-rent/1/acogedor-piso-en-anton-martin' }
    before :all do
      import_host_data = { slug: 're-renting', scraper_name: 'inmo1', host: 're-renting.com' }
      unless PropertyWebScraper::ImportHost.exists?(host: import_host_data[:host])
        PropertyWebScraper::ImportHost.create!(import_host_data)
      end

      # load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end

    it 'scrapes and save inmo1 property page correctly' do
      VCR.use_cassette('scrapers/inmo1') do
        # import_url =
        web_scraper = PropertyWebScraper::Scraper.new('inmo1')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_property = web_scraper.retrieve_and_save listing, 1

        expect(retrieved_property.for_sale).to eq(false)
        expect(retrieved_property.for_rent).to eq(true)


        expect(retrieved_property.longitude).to eq(-3.70364310000002)
        expect(retrieved_property.latitude).to eq(40.411213)
        expect(retrieved_property.reference).to eq("BUHARDILLA CALLE ATOCHA ANTON MARTIN")
        # expect(retrieved_property.image_urls[0]).to eq("http://media.inmo1.co.uk/dir/147k/146672/51775029/146672_87_School_Rd_IMG_00_0000.jpg")
        expect(retrieved_property.title).to eq("Acogedor piso en Anton Martin")
        # expect(retrieved_property.address_string).to eq("School Road, Birmingham, B14")
        expect(retrieved_property.currency).to eq('EUR')

        expect(retrieved_property.features.length).to eq(16)
        expect(retrieved_property.image_urls.length).to eq(18)


        # expect(retrieved_property.price_string).to eq('£995 pcm')
        expect(retrieved_property.price_float).to eq(1700.0)
      end
    end
  end
end
