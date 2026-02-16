require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Scraper' do
    it 'warns of non existent scraper' do
      expect { PropertyWebScraper::Scraper.new('dummy') }.to raise_error(ArgumentError)
    end

    it 'accepts a scraper_mapping as an argument' do
      scraper_mapping = PropertyWebScraper::ScraperMapping.find_by_name('cerdfw')
      scraper = PropertyWebScraper::Scraper.new(nil, scraper_mapping)
      expect(scraper.scraper_mapping).to eq(scraper_mapping)
    end

    describe '#process_url' do
      include_context 'with seeded import hosts'

      let(:import_host) { PropertyWebScraper::ImportHost.find_by_host('www.idealista.com') }
      let(:import_url) { 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
      let(:scraper) { PropertyWebScraper::Scraper.new('idealista') }

      it 'creates a new listing when none exists' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          listing = scraper.process_url(import_url, import_host)
          expect(listing).to be_a(PropertyWebScraper::Listing)
          expect(listing).to be_persisted
        end
      end

      it 'reuses an existing listing with the same import_url' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          listing1 = scraper.process_url(import_url, import_host)
          listing2 = scraper.process_url(import_url, import_host)
          expect(listing1.id).to eq(listing2.id)
        end
      end

      it 'refreshes a stale listing' do
        VCR.use_cassette('scrapers/idealista_2018_01', allow_playback_repeats: true) do
          listing = scraper.process_url(import_url, import_host)
          listing.update_column(:last_retrieved_at, 2.days.ago)
          refreshed = scraper.process_url(import_url, import_host)
          expect(refreshed.last_retrieved_at).to be > 1.minute.ago
        end
      end

      it 'does not re-fetch a recently retrieved listing' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          listing = scraper.process_url(import_url, import_host)
          original_retrieved_at = listing.last_retrieved_at
          # Second call should use cache (no VCR interaction needed)
          cached = scraper.process_url(import_url, import_host)
          expect(cached.last_retrieved_at).to eq(original_retrieved_at)
        end
      end
    end

    describe '#process_url with html: keyword' do
      include_context 'with seeded import hosts'

      let(:import_host) { PropertyWebScraper::ImportHost.find_by_host('www.idealista.com') }
      let(:import_url) { 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
      let(:scraper) { PropertyWebScraper::Scraper.new('idealista') }
      let(:html) do
        path = File.join(PropertyWebScraper::Engine.root, 'spec', 'fixtures', 'vcr', 'scrapers', 'idealista_2018_01.yml')
        cassette = YAML.safe_load(File.read(path), permitted_classes: [Symbol])
        cassette['http_interactions'].first['response']['body']['string']
      end

      it 'extracts data from provided HTML without making HTTP requests' do
        listing = scraper.process_url(import_url, import_host, html: html)
        expect(listing).to be_a(PropertyWebScraper::Listing)
        expect(listing.title).to eq('Piso en venta en goya, 54, Goya, Madrid')
        expect(listing.price_float).to eq(990000.0)
        # No VCR cassette needed — proves no HTTP call was made
      end

      it 'does not log the direct HTTP fetch warning when html is provided' do
        expect(Rails.logger).not_to receive(:warn).with(/Direct HTTP fetch/)
        scraper.process_url(import_url, import_host, html: html)
      end
    end

    describe '#retrieve_and_save with html: keyword' do
      include_context 'with seeded import hosts'

      let(:import_url) { 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
      let(:scraper) { PropertyWebScraper::Scraper.new('idealista') }
      let(:html) do
        path = File.join(PropertyWebScraper::Engine.root, 'spec', 'fixtures', 'vcr', 'scrapers', 'idealista_2018_01.yml')
        cassette = YAML.safe_load(File.read(path), permitted_classes: [Symbol])
        cassette['http_interactions'].first['response']['body']['string']
      end

      it 'uses HtmlExtractor when html is provided' do
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        result = scraper.retrieve_and_save(listing, 'idealista', html: html)
        expect(result.title).to eq('Piso en venta en goya, 54, Goya, Madrid')
        expect(result.price_float).to eq(990000.0)
        expect(result.reference).to eq('38604738')
      end
    end

    describe '#retrieve_from_webpage' do
      it 'returns a property hash with parsed fields' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          scraper = PropertyWebScraper::Scraper.new('idealista')
          result = scraper.retrieve_from_webpage('https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/')
          expect(result).to be_an(Array)
          expect(result.first).to be_a(Hash)
        end
      end
    end

    describe '#retrieve_from_webpage error paths' do
      let(:scraper) { PropertyWebScraper::Scraper.new('idealista') }
      let(:test_url) { 'https://www.idealista.com/inmueble/99999/' }

      it 'raises OpenURI::HTTPError on 404' do
        stub_request(:get, test_url).to_return(status: [404, 'Not Found'], body: '')
        expect { scraper.retrieve_from_webpage(test_url) }.to raise_error(OpenURI::HTTPError, /404/)
      end

      it 'raises OpenURI::HTTPError on 500' do
        stub_request(:get, test_url).to_return(status: [500, 'Internal Server Error'], body: '')
        expect { scraper.retrieve_from_webpage(test_url) }.to raise_error(OpenURI::HTTPError, /500/)
      end

      it 'raises on network timeout' do
        stub_request(:get, test_url).to_timeout
        expect { scraper.retrieve_from_webpage(test_url) }.to raise_error(Net::OpenTimeout)
      end

      it 'handles empty HTML gracefully' do
        stub_request(:get, test_url).to_return(status: 200, body: '', headers: { 'Content-Type' => 'text/html' })
        result = scraper.retrieve_from_webpage(test_url)
        expect(result).to be_an(Array)
        expect(result.first).to be_a(Hash)
      end

      it 'handles malformed HTML gracefully' do
        stub_request(:get, test_url).to_return(status: 200, body: '<div><p>unclosed', headers: { 'Content-Type' => 'text/html' })
        result = scraper.retrieve_from_webpage(test_url)
        expect(result).to be_an(Array)
        expect(result.first).to be_a(Hash)
      end

      it 'raises after too many redirects' do
        redirect_url = 'https://www.idealista.com/redirect/1'
        stub_request(:get, test_url).to_return(status: 302, headers: { 'Location' => redirect_url })
        stub_request(:get, redirect_url).to_return(status: 302, headers: { 'Location' => redirect_url })
        expect { scraper.retrieve_from_webpage(test_url) }.to raise_error(OpenURI::HTTPRedirect)
      end
    end
  end
end
