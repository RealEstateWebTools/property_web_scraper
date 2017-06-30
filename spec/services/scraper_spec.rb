require 'spec_helper'

module PropertyWebScraper
  RSpec.describe "Scraper" do
    it "warns of non existent scraper" do
      expect{ PropertyWebScraper::Scraper.new("dummy") }.to raise_error(ArgumentError)
    end
    it "scrapes and save realtor property page correctly" do
      VCR.use_cassette("scrapers/realtor") do
        target_url = "http://www.realtor.com/realestateandhomes-detail/5804-Cedar-Glen-Ln_Bakersfield_CA_93313_M12147-18296"

        web_scraper = PropertyWebScraper::Scraper.new("realtor")
        retrieved_properties = web_scraper.retrieve_and_save target_url, 1
        # byebug

        expect(retrieved_properties.as_json["import_history"]).not_to be_present
        # expect(retrieved_properties.as_json).not_to have_attributes("import_history") 
        expect(retrieved_properties.reference).to eq("21701902")
        expect(retrieved_properties.title).to eq("5804 Cedar Glen Ln")
        expect(retrieved_properties.constructed_area).to eq(1.133)
      end
    end
    it "scrapes and save mlslistings property page correctly" do
      VCR.use_cassette("scrapers/mlslistings") do
        target_url = "http://www.mlslistings.com/property/ml81643266/1547-desdemona-ct-san-jose-ca-95121/"

        web_scraper = PropertyWebScraper::Scraper.new("mlslistings")
        retrieved_properties = web_scraper.retrieve_and_save target_url, 1

        expect(retrieved_properties.reference).to eq("ML81643266")
        expect(retrieved_properties.constructed_area).to eq(1.176)
      end
    end
  end
end
