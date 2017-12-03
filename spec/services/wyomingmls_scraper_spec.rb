require 'spec_helper'


module PropertyWebScraper
  RSpec.describe 'Scraper' do
    import_url = 'http://www.wyomingmls.com/property_res.php?id=85738' 
   
    before :all do
      load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')
    end
    it 'finds import_host for url' do
      uri = URI.parse import_url
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      expect(import_host).to be_present
    end

    it 'scrapes and save wyomingmls property page correctly' do
      VCR.use_cassette('scrapers/wyomingmls') do
        web_scraper = PropertyWebScraper::Scraper.new('wyomingmls')
        listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
        retrieved_properties = web_scraper.retrieve_and_save listing, 1

        expect(retrieved_properties.as_json['import_history']).not_to be_present

        # expect(retrieved_properties.main_image_url).to eq('https://ap.rdcpix.com/1181386804/6af1cc185beff7ea3b6e5804e4b18854l-m0xd-w640_h480_q80.jpg')

        # expect(retrieved_properties.description).to eq('View 6 photos of this 3 bed, 2 bath, 1,133 Sq. Ft. condo/townhome/row home/co-op at 5804 Cedar Glen Ln, Bakersfield, CA 93313 on sale now for $144,950.')
        expect(retrieved_properties.longitude).to eq(-106.28227)
        expect(retrieved_properties.latitude).to eq(42.852044)

        expect(retrieved_properties.reference).to eq('20176813')
        




        expect(retrieved_properties.image_urls[0]).to eq("http://www.wyomingmls.com/images/property/wyo20176813a.jpg")
        expect(retrieved_properties.image_urls.count).to eq(10)

        # expect(retrieved_properties.title).to eq('5804 Cedar Glen Ln')
        expect(retrieved_properties.constructed_area).to eq(1056)
        expect(retrieved_properties.count_bedrooms).to eq(3)


        

        expect(retrieved_properties.currency).to eq('USD')
        expect(retrieved_properties.price_string).to eq('$33,500')
        expect(retrieved_properties.price_float).to eq(33500.0)


      end
    end
  end
end
