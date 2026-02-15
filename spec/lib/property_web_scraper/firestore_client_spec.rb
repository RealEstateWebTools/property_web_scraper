require 'spec_helper'

RSpec.describe PropertyWebScraper::FirestoreClient do
  after(:each) do
    # Re-inject the in-memory client so other specs aren't affected by reset!
    described_class.instance_variable_set(:@client, InMemoryFirestore::Client.new)
  end

  describe '.client' do
    it 'returns an InMemoryFirestore::Client in test mode' do
      expect(described_class.client).to be_a(InMemoryFirestore::Client)
    end

    it 'caches the client across calls' do
      first_call = described_class.client
      second_call = described_class.client
      expect(first_call).to equal(second_call)
    end
  end

  describe '.reset!' do
    it 'clears the cached client' do
      described_class.client
      described_class.reset!
      expect(described_class.instance_variable_get(:@client)).to be_nil
    end
  end
end
