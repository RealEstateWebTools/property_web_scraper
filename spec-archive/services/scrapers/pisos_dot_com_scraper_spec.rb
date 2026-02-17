require 'spec_helper'
# TODO - complete scraper for this

module PropertyWebScraper
  RSpec.describe 'Pisos dot com Scraper' do
    let(:import_url) { 'https://www.pisos.com/comprar/piso-goya28001-80065955842_100100/' }
    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end

    it 'scrapes and save pisos_dot_com property page correctly' do
      VCR.use_cassette('scrapers/pisos_dot_com') do
        # import_url =
        web_scraper = PropertyWebScraper::Scraper.new('pisos')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_property = web_scraper.retrieve_and_save listing, 1


        expect(retrieved_property.title).to eq("Piso en venta en Calle Goya, nº 54 en Goya por 990.000 €")
        # expect(retrieved_property.for_sale).to eq(true)
        # expect(retrieved_property.latitude).to eq(40.4246556)
        # expect(retrieved_property.longitude).to eq( -3.678188)
        # expect(retrieved_property.reference).to eq('38604738')
        # expect(retrieved_property.constructed_area).to eq(172)
        # expect(retrieved_property.currency).to eq('EUR')
        # expect(retrieved_property.price_string).to eq('990.000')
        # expect(retrieved_property.price_float).to eq(990000.0)
      end
    end
  end
end
