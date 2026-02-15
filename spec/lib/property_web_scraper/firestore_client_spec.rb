require 'spec_helper'

RSpec.describe PropertyWebScraper::FirestoreClient do
  after(:each) do
    described_class.reset!
  end

  describe '.client' do
    it 'returns a Google::Cloud::Firestore instance' do
      expect(described_class.client).to be_a(Google::Cloud::Firestore)
    end

    it 'caches the client across calls' do
      first_call = described_class.client
      second_call = described_class.client
      expect(first_call).to equal(second_call)
    end
  end

  describe '.reset!' do
    it 'clears the cached client so the next call builds a new one' do
      original = described_class.client
      described_class.reset!
      refreshed = described_class.client
      expect(refreshed).not_to equal(original)
    end
  end
end
