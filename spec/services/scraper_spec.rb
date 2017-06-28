require 'spec_helper'

module PropertyWebScraper
  RSpec.describe "Scraper" do
    it "warns of non existent scraper" do
      expect{ PropertyWebScraper::Scraper.new("dummy") }.to raise_error(ArgumentError)
    end
    it "scrapes realtor property page correctly" do
      VCR.use_cassette("scrapers/realtor") do
        target_url = "http://www.realtor.com/realestateandhomes-detail/5804-Cedar-Glen-Ln_Bakersfield_CA_93313_M12147-18296"

        web_scraper = PropertyWebScraper::Scraper.new("realtor")
        retrieved_properties = web_scraper.retrieve_from_webpage target_url

        expect(retrieved_properties.length).to eq(1)
        expect(retrieved_properties[0]["reference"]).to eq("21701902")
        expect(retrieved_properties[0]["constructed_area"]).to eq("1,133")
      end
    end
    it "scrapes mlslistings property page correctly" do
      VCR.use_cassette("scrapers/mlslistings") do
        target_url = "http://www.mlslistings.com/property/ml81643266/1547-desdemona-ct-san-jose-ca-95121/"

        web_scraper = PropertyWebScraper::Scraper.new("mlslistings")
        retrieved_properties = web_scraper.retrieve_from_webpage target_url

        expect(retrieved_properties.length).to eq(1)
        expect(retrieved_properties[0]["reference"]).to eq("ML81643266")
        expect(retrieved_properties[0]["constructed_area"]).to eq("1,176")
      end
    end
  end
end
