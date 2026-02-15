require 'spec_helper'

module PropertyWebScraper
  RSpec.describe ScraperMapping, type: :model do
    describe '.all' do
      it 'returns a collection of scraper mappings' do
        mappings = ScraperMapping.all
        expect(mappings).not_to be_empty
      end
    end

    describe '.find_by_name' do
      it 'returns the mapping for idealista' do
        mapping = ScraperMapping.find_by_name('idealista')
        expect(mapping).to be_present
        expect(mapping.name).to eq('idealista')
      end

      it 'returns the mapping for realtor' do
        mapping = ScraperMapping.find_by_name('realtor')
        expect(mapping).to be_present
        expect(mapping.name).to eq('realtor')
      end

      it 'returns nil for an unknown name' do
        mapping = ScraperMapping.find_by_name('nonexistent_scraper')
        expect(mapping).to be_nil
      end
    end
  end
end
