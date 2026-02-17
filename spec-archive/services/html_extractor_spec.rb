require 'spec_helper'
require 'yaml'

module PropertyWebScraper
  RSpec.describe HtmlExtractor do
    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end

    after :all do
      client = PropertyWebScraper::FirestoreClient.client
      client.col('import_hosts').list_documents.each { |doc| doc.delete }
    end

    # Helper to extract HTML body from a VCR cassette file
    def html_from_cassette(cassette_name)
      path = File.join(PropertyWebScraper::Engine.root, 'spec', 'fixtures', 'vcr', "#{cassette_name}.yml")
      cassette = YAML.safe_load(File.read(path), permitted_classes: [Symbol])
      cassette['http_interactions'].first['response']['body']['string']
    end

    describe '.call' do
      it 'raises ArgumentError for unknown mapping name' do
        expect {
          HtmlExtractor.call(html: '<html></html>', source_url: 'https://example.com', scraper_mapping_name: 'nonexistent')
        }.to raise_error(ArgumentError, /Unknown scraper mapping/)
      end

      it 'raises ArgumentError for unknown host when auto-detecting' do
        expect {
          HtmlExtractor.call(html: '<html></html>', source_url: 'https://unknown-host.example.com/page')
        }.to raise_error(ArgumentError, /No mapping found for host/)
      end

      it 'accepts a pre-loaded scraper_mapping' do
        mapping = ScraperMapping.find_by_name('idealista')
        result = HtmlExtractor.call(
          html: '<html></html>',
          source_url: 'https://www.idealista.com/inmueble/123/',
          scraper_mapping: mapping
        )
        expect(result[:success]).to eq(true)
        expect(result[:properties]).to be_an(Array)
      end

      it 'handles empty HTML gracefully' do
        mapping = ScraperMapping.find_by_name('idealista')
        result = HtmlExtractor.call(
          html: '',
          source_url: 'https://www.idealista.com/inmueble/123/',
          scraper_mapping: mapping
        )
        expect(result[:success]).to eq(true)
        expect(result[:properties].first).to be_a(Hash)
      end

      it 'handles malformed HTML gracefully' do
        mapping = ScraperMapping.find_by_name('idealista')
        result = HtmlExtractor.call(
          html: '<div><p>unclosed',
          source_url: 'https://www.idealista.com/inmueble/123/',
          scraper_mapping: mapping
        )
        expect(result[:success]).to eq(true)
        expect(result[:properties].first).to be_a(Hash)
      end
    end

    describe 'idealista extraction from raw HTML' do
      let(:source_url) { 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
      let(:html) { html_from_cassette('scrapers/idealista_2018_01') }

      it 'extracts the same values as the VCR-based scraper test' do
        result = HtmlExtractor.call(
          html: html,
          source_url: source_url,
          scraper_mapping_name: 'idealista'
        )
        expect(result[:success]).to eq(true)
        props = result[:properties].first

        expect(props['title']).to eq('Piso en venta en goya, 54, Goya, Madrid')
        expect(props['price_string']).to eq('990.000')
        expect(props['price_float']).to eq(990000.0)
        expect(props['currency']).to eq('EUR')
        expect(props['constructed_area']).to eq(172)
        expect(props['reference']).to eq('38604738')
        expect(props['for_sale']).to eq(true)
        expect(props['latitude']).to eq(40.4246556)
        expect(props['longitude']).to eq(-3.678188)
        expect(props['image_urls']).to be_an(Array)
        expect(props['image_urls'][18]).to eq('https://img3.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/48/37/34/254187544.jpg')
      end

      it 'auto-detects mapping from URL host' do
        result = HtmlExtractor.call(html: html, source_url: source_url)
        expect(result[:success]).to eq(true)
        expect(result[:properties].first['title']).to eq('Piso en venta en goya, 54, Goya, Madrid')
      end
    end

    describe 'rightmove extraction from raw HTML' do
      let(:source_url) { 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html' }
      let(:html) { html_from_cassette('scrapers/rightmove') }

      it 'extracts the same values as the VCR-based scraper test' do
        result = HtmlExtractor.call(
          html: html,
          source_url: source_url,
          scraper_mapping_name: 'rightmove'
        )
        expect(result[:success]).to eq(true)
        props = result[:properties].first

        expect(props['for_rent']).to eq(true)
        expect(props['longitude']).to eq(-1.8683744229091472)
        expect(props['latitude']).to eq(52.413249369181294)
        expect(props['postal_code']).to eq('B14 4JP')
        expect(props['reference']).to eq('51775029')
        expect(props['image_urls'][0]).to eq('http://media.rightmove.co.uk/dir/147k/146672/51775029/146672_87_School_Rd_IMG_00_0000.jpg')
        expect(props['title']).to eq('4 bedroom detached house to rent in School Road, Birmingham, B14, B14')
        expect(props['address_string']).to eq('School Road, Birmingham, B14')
        expect(props['currency']).to eq('GBP')
        expect(props['price_string']).to eq("\u00A3995 pcm")
        expect(props['price_float']).to eq(995.0)
      end
    end

    describe 'realtor extraction from raw HTML' do
      let(:source_url) { 'http://www.realtor.com/realestateandhomes-detail/5804-Cedar-Glen-Ln_Bakersfield_CA_93313_M12147-18296' }
      let(:html) { html_from_cassette('scrapers/realtor') }

      it 'extracts property data from raw HTML' do
        result = HtmlExtractor.call(
          html: html,
          source_url: source_url,
          scraper_mapping_name: 'realtor'
        )
        expect(result[:success]).to eq(true)
        props = result[:properties].first
        expect(props).to be_a(Hash)
        expect(props).to have_key('title')
      end
    end
  end
end
