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
  end
end
