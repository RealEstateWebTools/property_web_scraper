module PropertyWebScraper
  class Listing < ApplicationRecord
    enum area_unit: { sqmt: 0, sqft: 1 }

    # monetize :price_sale, with_model_currency: :currency
    # monetize :price_rental, with_model_currency: :currency

    def as_json(options = nil)
      super({ only: [
        :reference, :price_string, :price_float,
        :title, :description,
        :area_unit, :plot_area, :constructed_area,
        :count_bedrooms, :count_bathrooms,
        :count_toilets, :count_garages,
        :currency, :city, :region, :country,
        :address_string, :longitude, :latitude,
        :for_sale, :for_rent, :main_image_url,
        :last_retrieved_at, :unknown_fields
      ],
              methods: [] }.merge(options || {}))
    end

    def self.update_from_hash(listing, property_hash)
      attributes = %w(reference title description
                      price_string price_float area_unit address_string currency
                      country longitude latitude main_image_url for_rent for_sale image_urls )
      attributes.each do |attribute|
        listing[attribute] = property_hash[attribute]
      end
      # -1 indicates value could not be retrieved
      listing.constructed_area = property_hash['constructed_area'].presence || -1
      listing.count_bedrooms = property_hash['count_bedrooms'].presence || -1
      listing.count_bathrooms = property_hash['count_bathrooms'].presence || -1
      listing.count_toilets = property_hash['count_toilets'].presence || -1
      listing.count_garages = property_hash['count_garages'].presence || -1
      listing.save!
      # TODO: - save retrieval history
    end
  end
end
