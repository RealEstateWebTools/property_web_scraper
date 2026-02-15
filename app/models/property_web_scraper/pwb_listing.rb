module PropertyWebScraper
  # Extended listing with PropertyWebBuilder-compatible serialization.
  #
  # Inherits from {Listing} and adds computed pricing methods and a
  # +property_photos+ helper so the JSON output matches the format
  # expected by the PropertyWebBuilder front-end.
  class PwbListing < Listing
    # Returns a JSON-safe hash including computed pricing and photo fields.
    #
    # @param options [Hash, nil] additional options merged into the +super+ call
    # @return [Hash]
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

    # Returns the sale price when the property is for sale, otherwise 0.
    #
    # @return [Float]
    def price_sale_current
      if for_sale
        return price_float
      else
        return 0
      end
    end

    # Returns the monthly rental price when the property is for long-term rent, otherwise 0.
    #
    # @return [Float]
    def price_rental_monthly_current
      if for_rent_long_term
        return price_float
      else
        return 0
      end
    end

    # Converts +image_urls+ into an array of photo hashes.
    #
    # @return [Array<Hash>] e.g. +[{ url: "https://..." }, ...]+
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
  end
end
