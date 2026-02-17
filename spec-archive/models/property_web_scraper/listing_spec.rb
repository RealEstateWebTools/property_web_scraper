require 'spec_helper'

module PropertyWebScraper
  RSpec.describe Listing, type: :model do
    describe '#image_urls_are_array' do
      it 'is valid when image_urls is an array' do
        listing = build(:property_web_scraper_listing, image_urls: ['https://example.com/img.jpg'])
        expect(listing).to be_valid
      end

      it 'is valid when image_urls is an empty array' do
        listing = build(:property_web_scraper_listing, image_urls: [])
        expect(listing).to be_valid
      end

      it 'is invalid when image_urls is not an array' do
        listing = Listing.new
        listing.define_singleton_method(:image_urls) { 'not an array' }
        listing.valid?
        expect(listing.errors[:base]).to include('image_urls must be an array.')
      end
    end

    describe 'area_unit enum' do
      it 'defaults to sqmt' do
        listing = create(:property_web_scraper_listing)
        expect(listing.area_unit).to eq('sqmt')
      end

      it 'accepts sqft' do
        listing = create(:property_web_scraper_listing, area_unit: 'sqft')
        expect(listing.area_unit).to eq('sqft')
      end
    end

    describe '.update_from_hash' do
      let(:listing) { create(:property_web_scraper_listing) }
      let(:property_hash) do
        {
          'reference' => 'REF-123',
          'title' => 'Updated Title',
          'description' => 'Updated description',
          'price_string' => '300,000 EUR',
          'price_float' => 300_000.0,
          'area_unit' => 'sqmt',
          'currency' => 'EUR',
          'country' => 'Spain',
          'longitude' => -3.7038,
          'latitude' => 40.4168,
          'main_image_url' => 'https://example.com/main.jpg',
          'for_rent' => false,
          'for_sale' => true,
          'for_rent_short_term' => false,
          'for_rent_long_term' => false,
          'image_urls' => ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
          'street_address' => 'Calle Mayor 1',
          'address_string' => 'Calle Mayor 1, Madrid',
          'locale_code' => 'es',
          'city' => 'Madrid',
          'province' => 'Madrid',
          'region' => 'Comunidad de Madrid',
          'postal_code' => '28001',
          'features' => ['pool', 'garden'],
          'year_construction' => 2005,
          'constructed_area' => 150,
          'count_bedrooms' => 4,
          'count_bathrooms' => 2,
          'count_toilets' => 1,
          'count_garages' => 2
        }
      end

      it 'updates standard attributes from the hash' do
        Listing.update_from_hash(listing, property_hash)
        listing.reload
        expect(listing.title).to eq('Updated Title')
        expect(listing.price_float).to eq(300_000.0)
        expect(listing.country).to eq('Spain')
        expect(listing.for_sale).to eq(true)
      end

      it 'leaves numeric attributes nil when blank' do
        property_hash['count_bedrooms'] = nil
        property_hash['count_bathrooms'] = ''
        Listing.update_from_hash(listing, property_hash)
        listing.reload
        expect(listing.count_bedrooms).to be_nil
        expect(listing.count_bathrooms).to be_nil
      end

      it 'defaults image_urls to empty array when blank' do
        property_hash['image_urls'] = nil
        Listing.update_from_hash(listing, property_hash)
        listing.reload
        expect(listing.image_urls).to eq([])
      end
    end

    describe '#import_host' do
      include_context 'with seeded import hosts'

      it 'returns nil when import_host_slug is blank' do
        listing = create(:property_web_scraper_listing, import_host_slug: nil)
        expect(listing.import_host).to be_nil
      end

      it 'returns the ImportHost when slug is valid' do
        listing = create(:property_web_scraper_listing, import_host_slug: 'idealista')
        expect(listing.import_host).to be_a(ImportHost)
        expect(listing.import_host.host).to eq('www.idealista.com')
      end

      it 'memoizes the result' do
        listing = create(:property_web_scraper_listing, import_host_slug: 'idealista')
        first_call = listing.import_host
        second_call = listing.import_host
        expect(first_call).to equal(second_call)
      end

      it 'clears memo on import_host_slug reassignment' do
        listing = create(:property_web_scraper_listing, import_host_slug: 'idealista')
        listing.import_host # populate memo
        listing.import_host_slug = 'realtor'
        expect(listing.import_host.host).to eq('www.realtor.com')
      end

      it 'clears memo on reload' do
        listing = create(:property_web_scraper_listing, import_host_slug: 'idealista')
        listing.import_host # populate memo
        listing.reload
        # After reload, should re-fetch (still returns same host)
        expect(listing.import_host.host).to eq('www.idealista.com')
      end
    end

    describe '#as_json' do
      let(:listing) { create(:property_web_scraper_listing, :with_location, :with_images) }

      it 'includes expected keys' do
        json = listing.as_json
        expected_keys = %w[import_url reference price_string price_float title description
                           area_unit plot_area constructed_area year_construction
                           count_bedrooms count_bathrooms count_toilets count_garages
                           currency street_number street_name street_address postal_code
                           city province region country address_string longitude latitude
                           for_sale for_rent main_image_url last_retrieved_at image_urls
                           features unknown_fields]
        expected_keys.each do |key|
          expect(json).to have_key(key)
        end
      end

      it 'excludes internal keys like id and timestamps' do
        json = listing.as_json
        expect(json).not_to have_key('id')
        expect(json).not_to have_key('created_at')
        expect(json).not_to have_key('updated_at')
        expect(json).not_to have_key('import_host_slug')
      end
    end
  end
end
