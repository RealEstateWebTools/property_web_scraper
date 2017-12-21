require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Fotocasa Scraper' do
    let(:import_url) { 'https://www.fotocasa.es/vivienda/marbella/aire-acondicionado-parking-terraza-ascensor-piscina-no-amueblado-el-higueral-la-merced-145228694' }
    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end

    it 'scrapes and save fotocasa property page correctly' do
      VCR.use_cassette('scrapers/fotocasa') do
        # import_url =
        web_scraper = PropertyWebScraper::Scraper.new('fotocasa')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_properties = web_scraper.retrieve_and_save listing, 1

        expect(retrieved_properties.country).to eq("Spain")
        expect(retrieved_properties.count_bedrooms).to eq(3)
        expect(retrieved_properties.count_bathrooms).to eq(3)
        # expect(retrieved_properties.latitude).to eq(40.732845)
        # expect(retrieved_properties.longitude).to eq(-3.5815072)
        # expect(retrieved_properties.reference).to eq('1678322')
        # expect(retrieved_properties.constructed_area).to eq(70)
        # expect(retrieved_properties.currency).to eq('EUR')
        # expect(retrieved_properties.price_string).to eq('82.000')
        # expect(retrieved_properties.price_float).to eq(82_000.0)
      end
    end
  end
end
