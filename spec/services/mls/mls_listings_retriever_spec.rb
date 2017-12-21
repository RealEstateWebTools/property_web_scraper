require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'MlsListingsRetriever' do
    it 'warns of not supported MLS' do
      expect { PropertyWebScraper::MlsListingsRetriever.new('dummy').retrieve("","") }.to raise_error(ArgumentError)
    end

    it 'retrieves MRIS data correctly' do
      VCR.use_cassette('mls/interealty') do
        limit = 5
        retrieved_properties = PropertyWebScraper::MlsListingsRetriever.new("interealty","correct_pwd").retrieve("(ListPrice=0+)", limit)

        expect(retrieved_properties.count).to eq(5)
        # expect( retrieved_properties[0]["AddressCity"]).to eq("Bastrop")
        expect(retrieved_properties[0]["price_sale_current"]).to eq("17000")
      end
    end
  end
end
