require 'spec_helper'

module PropertyWebScraper
  RSpec.describe ImportHost, type: :model do
    let(:import_host) { create(:property_web_scraper_import_host, host: 'www.example.com') }

    describe '#host_url' do
      it 'returns the host prefixed with http://' do
        expect(import_host.host_url).to eq('http://www.example.com')
      end
    end

    describe '#stale_age_duration' do
      it 'returns an ActiveSupport::Duration' do
        expect(import_host.stale_age_duration).to be_a(ActiveSupport::Duration)
      end

      it 'returns 1 day by default' do
        expect(import_host.stale_age_duration).to eq(1.day)
      end
    end
  end
end
