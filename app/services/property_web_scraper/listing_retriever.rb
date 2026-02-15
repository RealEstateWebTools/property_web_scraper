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
      import_uri = get_import_uri
      unless import_uri.is_a?(URI::HTTP) || import_uri.is_a?(URI::HTTPS)
        result.error_message = "Invalid Url"
        return result
      end
      import_host = PropertyWebScraper::ImportHost.find_by_host(import_uri.host)


      unless import_host
        result.error_message = "Unsupported Url"
        return result
      end
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

    private

    def get_import_uri
      begin
        uri = URI.parse import_url
      rescue URI::InvalidURIError => error
        uri = ""
      end
    end

  end
end
