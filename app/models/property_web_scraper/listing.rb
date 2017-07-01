module PropertyWebScraper
  class Listing < ApplicationRecord
    def as_json(options = nil)
      super({ only: [
        :reference, :price, :title, :description, :plot_area,
        :constructed_area, :count_bedrooms, :count_bathrooms,
        :count_toilets, :count_garages,
        :currency, :city, :region, :country
      ],
              methods: [] }.merge(options || {}))
    end
  end
end
