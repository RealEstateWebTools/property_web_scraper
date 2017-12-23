require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'MlsListingsRetriever' do
    it 'warns of not supported MLS' do
      expect { PropertyWebScraper::MlsListingsRetriever.new('dummy').retrieve("","") }.to raise_error(ArgumentError)
    end

    it 'retrieves MRIS data correctly' do
      VCR.use_cassette('mls/interealty') do
        limit = 5

        retriever = PropertyWebScraper::MlsListingsRetriever.new("interealty","correct_pwd")
        result = retriever.retrieve("(ListPrice=0+)", limit)
        retrieved_properties = result.properties


        expect(retrieved_properties.count).to eq(5)

        expect(retrieved_properties[0]["price_sale_current"]).to eq("17000")
        expect(retrieved_properties[0]["reference"]).to eq("533325")
        expect(retrieved_properties[0]["street_number"]).to eq("593")
        expect(retrieved_properties[0]["street_name"]).to eq("HYMILL")
      end
    end
  end
end
