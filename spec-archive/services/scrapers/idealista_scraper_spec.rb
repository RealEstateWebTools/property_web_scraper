require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Idealista Scraper' do
    let(:import_url) { 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
    # let(:import_url) { 'https://www.idealista.com/inmueble/1678322/' }
    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end

    it 'scrapes and save idealista property page correctly' do
      VCR.use_cassette('scrapers/idealista_2018_01') do
        # import_url =
        web_scraper = PropertyWebScraper::Scraper.new('idealista')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_property = web_scraper.retrieve_and_save listing, 1

# byebug

        expect(retrieved_property.image_urls[18]).to eq("https://img3.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/48/37/34/254187544.jpg")
        expect(retrieved_property.title).to eq("Piso en venta en goya, 54, Goya, Madrid")
        expect(retrieved_property.for_sale).to eq(true)
        expect(retrieved_property.latitude).to eq(40.4246556)
        expect(retrieved_property.longitude).to eq( -3.678188)
        expect(retrieved_property.reference).to eq('38604738')
        expect(retrieved_property.constructed_area).to eq(172)
        expect(retrieved_property.currency).to eq('EUR')
        expect(retrieved_property.price_string).to eq('990.000')
        expect(retrieved_property.price_float).to eq(990000.0)
      end
    end
  end
end
