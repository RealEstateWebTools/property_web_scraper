require 'spec_helper'

module PropertyWebScraper
  RSpec.describe PwbListing, type: :model do
    describe '#price_sale_current' do
      it 'returns price_float when for_sale is true' do
        listing = create(:property_web_scraper_listing, for_sale: true, price_float: 500_000.0)
        pwb = PwbListing.find(listing.id)
        expect(pwb.price_sale_current).to eq(500_000.0)
      end

      it 'returns 0 when for_sale is false' do
        listing = create(:property_web_scraper_listing, for_sale: false, price_float: 500_000.0)
        pwb = PwbListing.find(listing.id)
        expect(pwb.price_sale_current).to eq(0)
      end
    end

    describe '#price_rental_monthly_current' do
      it 'returns price_float when for_rent_long_term is true' do
        listing = create(:property_web_scraper_listing, :for_rent)
        pwb = PwbListing.find(listing.id)
        expect(pwb.price_rental_monthly_current).to eq(listing.price_float)
      end

      it 'returns 0 when for_rent_long_term is false' do
        listing = create(:property_web_scraper_listing, for_rent_long_term: false, price_float: 1_200.0)
        pwb = PwbListing.find(listing.id)
        expect(pwb.price_rental_monthly_current).to eq(0)
      end
    end

    describe '#property_photos' do
      it 'transforms image_urls to array of hashes with url key' do
        listing = create(:property_web_scraper_listing, :with_images)
        pwb = PwbListing.find(listing.id)
        photos = pwb.property_photos
        expect(photos).to eq([
          { url: 'https://example.com/img1.jpg' },
          { url: 'https://example.com/img2.jpg' }
        ])
      end

      it 'returns empty array when image_urls is empty' do
        listing = create(:property_web_scraper_listing, image_urls: [])
        pwb = PwbListing.find(listing.id)
        expect(pwb.property_photos).to eq([])
      end

      it 'returns empty array when image_urls is nil' do
        listing = create(:property_web_scraper_listing)
        listing.update_column(:image_urls, nil)
        pwb = PwbListing.find(listing.id)
        expect(pwb.property_photos).to eq([])
      end
    end

    describe '#as_json' do
      it 'includes method-based keys' do
        listing = create(:property_web_scraper_listing, :with_images, for_sale: true, price_float: 300_000.0)
        pwb = PwbListing.find(listing.id)
        json = pwb.as_json
        expect(json).to have_key('property_photos')
        expect(json).to have_key('price_rental_monthly_current')
        expect(json).to have_key('price_sale_current')
      end

      it 'includes standard listing keys' do
        listing = create(:property_web_scraper_listing)
        pwb = PwbListing.find(listing.id)
        json = pwb.as_json
        expect(json).to have_key('title')
        expect(json).to have_key('description')
        expect(json).to have_key('count_bedrooms')
      end
    end
  end
end
