require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Listing retriever' do
    let(:valid_import_url) { 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
    let(:invalid_import_url) { 'https://www.google.com' }

    include_context 'with seeded import hosts'

    it 'detects invalid urls' do
      listing_retriever = PropertyWebScraper::ListingRetriever.new("not a url")
      result = listing_retriever.retrieve
      expect(result.success).to eq(false)
      expect(result.error_message).to eq("Invalid Url")
    end

    it 'returns Invalid Url for an empty string' do
      listing_retriever = PropertyWebScraper::ListingRetriever.new("")
      result = listing_retriever.retrieve
      expect(result.success).to eq(false)
      expect(result.error_message).to eq("Invalid Url")
    end

    it 'detects unsupported urls' do
      listing_retriever = PropertyWebScraper::ListingRetriever.new(invalid_import_url)
      result = listing_retriever.retrieve
      expect(result.success).to eq(false)
      expect(result.error_message).to eq("Unsupported Url")
    end

    it 'captures scraper exceptions gracefully' do
      allow_any_instance_of(PropertyWebScraper::Scraper).to receive(:process_url).and_raise(StandardError, 'connection error')
      listing_retriever = PropertyWebScraper::ListingRetriever.new(valid_import_url)
      result = listing_retriever.retrieve
      expect(result.success).to eq(false)
      expect(result.error_message).to eq('connection error')
    end

    it 'exposes import_url via accessor' do
      listing_retriever = PropertyWebScraper::ListingRetriever.new(valid_import_url)
      expect(listing_retriever.import_url).to eq(valid_import_url)
    end

    it 'retrieves valid listing' do
      VCR.use_cassette('scrapers/idealista_2018_01') do
        listing_retriever = PropertyWebScraper::ListingRetriever.new(valid_import_url)
        result = listing_retriever.retrieve
        expect(result.success).to eq(true)
        expect(result.retrieved_listing.import_host_slug).to eq("es_idealista")
      end
    end

    describe 'with html: keyword' do
      let(:html) do
        path = File.join(PropertyWebScraper::Engine.root, 'spec', 'fixtures', 'vcr', 'scrapers', 'idealista_2018_01.yml')
        cassette = YAML.safe_load(File.read(path), permitted_classes: [Symbol])
        cassette['http_interactions'].first['response']['body']['string']
      end

      it 'retrieves listing from provided HTML without HTTP fetch' do
        listing_retriever = PropertyWebScraper::ListingRetriever.new(valid_import_url, html: html)
        result = listing_retriever.retrieve
        expect(result.success).to eq(true)
        expect(result.retrieved_listing.title).to eq('Piso en venta en goya, 54, Goya, Madrid')
      end
    end

    describe 'error path handling' do
      it 'captures OpenURI::HTTPError gracefully' do
        allow_any_instance_of(PropertyWebScraper::Scraper).to receive(:process_url)
          .and_raise(OpenURI::HTTPError.new('404 Not Found', StringIO.new))
        listing_retriever = PropertyWebScraper::ListingRetriever.new(valid_import_url)
        result = listing_retriever.retrieve
        expect(result.success).to eq(false)
        expect(result.error_message).to include('404')
      end

      it 'captures Net::OpenTimeout gracefully' do
        allow_any_instance_of(PropertyWebScraper::Scraper).to receive(:process_url)
          .and_raise(Net::OpenTimeout, 'execution expired')
        listing_retriever = PropertyWebScraper::ListingRetriever.new(valid_import_url)
        result = listing_retriever.retrieve
        expect(result.success).to eq(false)
        expect(result.error_message).to include('execution expired')
      end

      it 'handles special characters in URLs' do
        url_with_special = 'https://www.idealista.com/inmueble/hello%20world/'
        listing_retriever = PropertyWebScraper::ListingRetriever.new(url_with_special)
        allow_any_instance_of(PropertyWebScraper::Scraper).to receive(:process_url)
          .and_raise(StandardError, 'page not found')
        result = listing_retriever.retrieve
        expect(result.success).to eq(false)
        expect(result.error_message).to eq('page not found')
      end
    end
  end
end
