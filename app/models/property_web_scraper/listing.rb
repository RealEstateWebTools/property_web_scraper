module PropertyWebScraper
  # Represents a scraped real estate listing.
  #
  # Stores property details retrieved from supported real estate websites
  # including pricing, location, dimensions, and images.
  #
  # @example Creating a listing from a scraper result
  #   listing = Listing.where(import_url: url).first_or_create
  #   Listing.update_from_hash(listing, property_hash)
  class Listing < ApplicationRecord
    enum area_unit: { sqmt: 0, sqft: 1 }

    validate :image_urls_are_array

    # Validates that +image_urls+ is an Array.
    #
    # @return [void]
    def image_urls_are_array
      if !image_urls.is_a?(Array)
        errors.add(:base, "image_urls must be an array.")
      end
    end

    # Returns a JSON-safe hash of public listing attributes.
    #
    # Excludes internal fields such as +id+, +created_at+, and +import_host_slug+.
    #
    # @param options [Hash, nil] additional options merged into the +super+ call
    # @return [Hash] the listing attributes
    def as_json(options = nil)
      super({ only: [
                :import_url,
                :reference, :price_string, :price_float,
                :title, :description,
                :area_unit, :plot_area, :constructed_area,
                :year_construction,
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

    # Populates a listing record from a scraped property hash and saves it.
    #
    # Standard string/boolean attributes are copied directly. Numeric
    # attributes default to +0+ when blank. Image URLs default to an
    # empty array when blank.
    #
    # @param listing [Listing] the listing record to update
    # @param property_hash [Hash] scraped property data keyed by attribute name
    # @return [void]
    def self.update_from_hash(listing, property_hash)
      std_attributes = %w(reference title description
                      price_string price_float area_unit currency
                      country longitude latitude main_image_url for_rent for_sale image_urls
                      for_rent_short_term for_rent_long_term
                      street_address address_string locale_code
                      city province region
                      postal_code features )
      std_attributes.each do |attribute|
        listing[attribute] = property_hash[attribute]
      end

      numeric_attributes = %w(year_construction constructed_area
                              count_bedrooms count_bathrooms
                              count_toilets count_garages)
      numeric_attributes.each do |attribute|
        listing[attribute] = property_hash[attribute].presence
      end

      listing.image_urls = property_hash['image_urls'].presence || []

      listing.save!
      # TODO: - save retrieval history
    end
  end
end
