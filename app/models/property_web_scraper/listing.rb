module PropertyWebScraper
  class Listing < ApplicationRecord
    enum area_unit: { sqmt: 0, sqft: 1 }

    # monetize :price_sale, with_model_currency: :currency
    # monetize :price_rental, with_model_currency: :currency


    # validates :image_urls, presence: true
    validate :image_urls_are_array


    def image_urls_are_array
      if !image_urls.is_a?(Array)
        errors[:base] << "image_urls must be an array."
        # errors.add(:image_urls, "..")
      end
    end


    def as_json(options = nil)
      super({ only: [
                :import_url,
                :reference, :price_string, :price_float,
                :title, :description,
                :area_unit, :plot_area, :constructed_area,
                :count_bedrooms, :count_bathrooms,
                :count_toilets, :count_garages,
                :currency,
                :street_number, :street_name,
                :street_address, :postal_code,
                :city, :province,
                :region, :country,
                :address_string, :longitude, :latitude,
                :for_sale, :for_rent, :main_image_url,
                :last_retrieved_at, :image_urls,
                :features, :unknown_fields
              ],
              methods: [] }.merge(options || {}))
    end

    def self.update_from_hash(listing, property_hash)
      std_attributes = %w(reference title description
                      price_string price_float area_unit currency
                      country longitude latitude main_image_url for_rent for_sale image_urls
                      for_rent_short_term for_rent_long_term
                      street_address address_string locale_code 
                      city province region
                      postal_code )
      std_attributes.each do |attribute|
        listing[attribute] = property_hash[attribute]
      end

      numeric_attributes = %w(year_construction constructed_area
                              count_bedrooms count_bathrooms
                              count_toilets count_garages)
      numeric_attributes.each do |attribute|
        listing[attribute] = property_hash[attribute].presence || 0
      end
      # considered using
      # -1 to indicate value could not be retrieved
      # but no longer convinced..

      listing.image_urls = property_hash['image_urls'].presence || []

      # listing.year_construction = property_hash['year_construction'].presence || 0
      # listing.constructed_area = property_hash['constructed_area'].presence || 0
      # listing.count_bedrooms = property_hash['count_bedrooms'].presence || 0
      # listing.count_bathrooms = property_hash['count_bathrooms'].presence || 0
      # listing.count_toilets = property_hash['count_toilets'].presence || 0
      # listing.count_garages = property_hash['count_garages'].presence || 0

      listing.save!
      # TODO: - save retrieval history
    end
  end
end
