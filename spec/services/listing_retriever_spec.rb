require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Listing retriever' do
    let(:valid_import_url) { 'https://www.idealista.com/inmueble/1678322/' }
    let(:invalid_import_url) { 'https://www.google.com' }
    # before :all do
    #   load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    # end


    it 'detects invalid urls' do
      listing_retriever = PropertyWebScraper::ListingRetriever.new("not a url")
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

    it 'retrieves valid listing' do
      listing_retriever = PropertyWebScraper::ListingRetriever.new(valid_import_url)
      result = listing_retriever.retrieve 
      expect(result.success).to eq(true)
      expect(result.retrieved_listing.import_host_slug).to eq("idealista")      
    end
  end
end
