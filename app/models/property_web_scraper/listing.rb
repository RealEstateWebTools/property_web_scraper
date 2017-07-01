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
        :address_string,
        :last_retrieved_at
      ],
              methods: [] }.merge(options || {}))
    end
  end
end
