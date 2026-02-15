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
    firestore_collection :listings

    # Property identification
    attribute :reference, :string
    attribute :import_url, :string
    attribute :import_host_slug, :string
    attribute :re_agent_id, :integer

    # Pricing
    attribute :price_string, :string
    attribute :price_float, :float
    attribute :currency, :string

    # Property details
    attribute :title, :string
    attribute :description, :string
    attribute :locale_code, :string
    attribute :area_unit, :string, default: 'sqmt'
    attribute :plot_area, :float, default: 0.0
    attribute :constructed_area, :float, default: 0.0
    attribute :year_construction, :integer, default: 0
    attribute :count_bedrooms, :integer, default: 0
    attribute :count_bathrooms, :float, default: 0.0
    attribute :count_toilets, :integer, default: 0
    attribute :count_garages, :integer, default: 0
    attribute :energy_rating, :integer
    attribute :energy_performance, :float

    # Multilingual titles/descriptions
    attribute :title_es, :string
    attribute :description_es, :string
    attribute :title_de, :string
    attribute :description_de, :string
    attribute :title_fr, :string
    attribute :description_fr, :string
    attribute :title_it, :string
    attribute :description_it, :string

    # Status flags
    attribute :furnished, :boolean, default: false
    attribute :sold, :boolean, default: false
    attribute :reserved, :boolean, default: false
    attribute :for_rent_short_term, :boolean, default: false
    attribute :for_rent_long_term, :boolean, default: false
    attribute :for_sale, :boolean, default: false
    attribute :for_rent, :boolean, default: false

    # Dates
    attribute :deleted_at, :datetime
    attribute :active_from, :datetime
    attribute :available_to_rent_from, :datetime
    attribute :available_to_rent_till, :datetime
    attribute :last_retrieved_at, :datetime

    # Location
    attribute :address_string, :string
    attribute :street_number, :string
    attribute :street_name, :string
    attribute :street_address, :string
    attribute :postal_code, :string
    attribute :province, :string
    attribute :city, :string
    attribute :region, :string
    attribute :country, :string
    attribute :latitude, :float
    attribute :longitude, :float

    # Media and extras
    attribute :main_image_url, :string
    attribute :image_urls, :array, default: []
    attribute :related_urls, :array, default: []
    attribute :features, :array, default: []
    attribute :unknown_fields, :array, default: []
    attribute :import_history, :hash, default: {}

    validate :image_urls_are_array

    # Returns the associated {ImportHost} for this listing.
    #
    # Looks up ImportHost by +import_host_slug+ (which is the document ID).
    # Memoized; cleared on +import_host_slug=+ or +reload+.
    #
    # @return [ImportHost, nil]
    def import_host
      @_import_host ||= import_host_slug.present? ? ImportHost.find(import_host_slug) : nil
    end

    def import_host_slug=(value)
      @_import_host = nil
      @import_host_slug = value
    end

    def reload
      @_import_host = nil
      super
    end

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
      property_hash = ScrapedContentSanitizer.call(property_hash)
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
    end
  end
end
