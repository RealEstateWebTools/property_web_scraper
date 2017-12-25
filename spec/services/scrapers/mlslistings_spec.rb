require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Mlslistings Scraper' do
    let(:import_url) { 'http://www.mlslistings.com/property/ml81643266/1547-desdemona-ct-san-jose-ca-95121/' }
    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end
    it 'scrapes and save mlslistings property page correctly' do
      VCR.use_cassette('scrapers/mlslistings') do
        # import_url =
        web_scraper = PropertyWebScraper::Scraper.new('mlslistings')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_property = web_scraper.retrieve_and_save listing, 1

        expect(retrieved_property.reference).to eq('ML81643266')
        expect(retrieved_property.main_image_url).to eq('http://data.mlslistings.com/GetMedia.ashx?Q=RmlsZUlEPTM5NjkwMTI5NQ%3d%3d&Hash=5a5ff2643e30251129add44affeb7455')
        expect(retrieved_property.longitude).to eq(-121.8234990)
        expect(retrieved_property.title).to eq('1547 Desdemona CT, SAN JOSE, CA 95121 ( For Sale )')
        expect(retrieved_property.constructed_area).to eq(1176)
        expect(retrieved_property.currency).to eq('USD')
        expect(retrieved_property.price_string).to eq('$489,000')
        expect(retrieved_property.price_float).to eq(489_000.0)
        expect(retrieved_property.count_bedrooms).to eq(3)
        expect(retrieved_property.for_sale).to eq(true)
      end
    end
  end
end
