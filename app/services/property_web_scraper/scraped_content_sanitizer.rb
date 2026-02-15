require 'rails-html-sanitizer'

module PropertyWebScraper
  # Sanitizes scraped property data before persistence.
  #
  # Strips HTML tags from text fields, rejects dangerous URL schemes
  # (e.g. +javascript:+), filters invalid URLs from array fields,
  # and fixes protocol-relative URLs.
  class ScrapedContentSanitizer
    TEXT_FIELDS = %w[
      title description reference price_string currency
      address_string street_address street_number street_name
      city province region country postal_code locale_code area_unit
      title_es description_es title_de description_de
      title_fr description_fr title_it description_it
    ].freeze

    URL_FIELDS = %w[main_image_url].freeze

    URL_ARRAY_FIELDS = %w[image_urls related_urls].freeze

    SAFE_SCHEMES = %w[http https].freeze

    FULL_SANITIZER = Rails::HTML::FullSanitizer.new

    # Sanitizes a property hash in-place and returns it.
    #
    # @param property_hash [Hash] scraped property data
    # @return [Hash] the sanitized hash
    def self.call(property_hash)
      TEXT_FIELDS.each do |field|
        value = property_hash[field]
        next unless value.is_a?(String)
        property_hash[field] = FULL_SANITIZER.sanitize(value).strip
      end

      URL_FIELDS.each do |field|
        value = property_hash[field]
        next unless value.is_a?(String)
        property_hash[field] = sanitize_url(value)
      end

      URL_ARRAY_FIELDS.each do |field|
        value = property_hash[field]
        next unless value.is_a?(Array)
        property_hash[field] = value.filter_map { |url| sanitize_url(url) if url.is_a?(String) }
      end

      if property_hash["features"].is_a?(Array)
        property_hash["features"] = property_hash["features"].map do |feature|
          feature.is_a?(String) ? FULL_SANITIZER.sanitize(feature).strip : feature
        end
      end

      property_hash
    end

    # Sanitizes a single URL string.
    #
    # - Rejects dangerous schemes (javascript:, data:, etc.)
    # - Fixes protocol-relative URLs (//example.com → https://example.com)
    # - Returns nil for invalid URLs
    #
    # @param url [String]
    # @return [String, nil]
    def self.sanitize_url(url)
      return nil if url.blank?

      stripped = url.strip

      # Fix protocol-relative URLs
      if stripped.start_with?("//")
        stripped = "https:#{stripped}"
      end

      uri = URI.parse(stripped)
      return nil unless SAFE_SCHEMES.include?(uri.scheme&.downcase)
      stripped
    rescue URI::InvalidURIError
      nil
    end

    private_class_method :sanitize_url
  end
end
