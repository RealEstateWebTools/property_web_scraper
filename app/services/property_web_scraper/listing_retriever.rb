require 'ostruct'
require 'nokogiri'
require 'open-uri'
require 'faraday'

module PropertyWebScraper
  # High-level service for retrieving a property listing by URL.
  #
  # Validates the URL, resolves the matching {ImportHost}, delegates
  # to {Scraper}, and wraps the result in an +OpenStruct+ with
  # +success+, +error_message+, and +retrieved_listing+ fields.
  #
  # @example
  #   result = ListingRetriever.new('https://www.idealista.com/inmueble/123/').retrieve
  #   if result.success
  #     result.retrieved_listing  #=> Listing
  #   else
  #     result.error_message      #=> "Unsupported Url"
  #   end
  class ListingRetriever
    # TODO - add logic to retrieve
    # from db or scraper depending on expiry
    attr_accessor :import_url

    # @param import_url [String] the property page URL to retrieve
    def initialize(import_url)
      @import_url = import_url
    end

    # Validates the URL, finds the import host, and scrapes the listing.
    #
    # @return [OpenStruct] with +success+ (Boolean), +error_message+ (String),
    #   and +retrieved_listing+ ({Listing}) fields
    def retrieve
      Rails.logger.info "PropertyWebScraper: ListingRetriever attempting #{import_url}"
      result = OpenStruct.new(:success => false, :error_message => "not processed")
      validation = PropertyWebScraper::UrlValidator.call(import_url)
      unless validation.valid?
        result.error_message = case validation.error_code
                               when UrlValidator::UNSUPPORTED then "Unsupported Url"
                               else "Invalid Url"
                               end
        return result
      end
      import_host = validation.import_host
      web_scraper = PropertyWebScraper::Scraper.new(import_host.scraper_name)
      begin
        retrieved_listing = web_scraper.process_url import_url, import_host
        result.retrieved_listing = retrieved_listing
        result.success = true
        Rails.logger.info "PropertyWebScraper: ListingRetriever succeeded for #{import_url}"
      rescue StandardError => e
        Rails.logger.error "PropertyWebScraper: ListingRetriever#retrieve failed for #{import_url}: #{e.class} - #{e.message}"
        Rails.logger.error e.backtrace&.first(10)&.join("\n")
        result.error_message = e.message
      end
      return result
    end

  end
end
