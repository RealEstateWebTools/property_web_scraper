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
  end
end
