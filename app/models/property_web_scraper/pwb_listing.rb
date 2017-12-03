module PropertyWebScraper
  class PwbListing < Listing
    enum area_unit: { sqmt: 0, sqft: 1 }

    # monetize :price_sale, with_model_currency: :currency
    # monetize :price_rental, with_model_currency: :currency

    def as_json(options = nil)
      super({ only: [
                :reference, :locale_code,
                :title, :description,
                :area_unit, :plot_area, :constructed_area,
                :count_bedrooms, :count_bathrooms,
                :count_toilets, :count_garages,
                :currency,
                :street_number, :street_name,
                :street_address, :postal_code,
                :city, :province,
                :region, :country,
                :longitude, :latitude,
                :for_sale, :for_rent_long_term,
                :for_rent_short_term,
                :features
              ],
              methods: [:property_photos, :price_rental_monthly_current, :price_sale_current] }.merge(options || {}))
    end

    def price_sale_current
      if for_sale
        return price_float
      else
        return 0
      end
    end

    # a field exists in db for above and below but for now prefer to
    # make decision here

    def price_rental_monthly_current
      if for_rent_long_term
        return price_float
      else
        return 0
      end
    end

    def property_photos
      property_photos = []
      image_urls = self.image_urls || []
      image_urls.each do |image_url|
        property_photos.push({
          url: image_url
        })
      end
      return property_photos
    end

    # def self.update_from_hash(listing, property_hash)
    #   attributes = %w(reference title description
    #                   price_string price_float area_unit address_string currency
    #                   country longitude latitude main_image_url for_rent for_sale image_urls )
    #   attributes.each do |attribute|
    #     listing[attribute] = property_hash[attribute]
    #   end
    #   # -1 indicates value could not be retrieved
    #   listing.constructed_area = property_hash['constructed_area'].presence || -1
    #   listing.count_bedrooms = property_hash['count_bedrooms'].presence || -1
    #   listing.count_bathrooms = property_hash['count_bathrooms'].presence || -1
    #   listing.count_toilets = property_hash['count_toilets'].presence || -1
    #   listing.count_garages = property_hash['count_garages'].presence || -1
    #   listing.save!
    #   # TODO: - save retrieval history
    # end
  end
end
