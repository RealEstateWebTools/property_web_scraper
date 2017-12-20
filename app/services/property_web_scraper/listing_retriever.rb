require 'nokogiri'
require 'open-uri'
require 'faraday'

module PropertyWebScraper
  class ListingRetriever
    # TODO - add logic to retrieve
    # from db or scraper depending on expiry
    attr_accessor :import_url

    def initialize(import_url)
      @import_url = import_url
    end

    def retrieve
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
      rescue Exception => e
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
