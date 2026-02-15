module PropertyWebScraper
  # REST API for retrieving property listings as JSON.
  #
  # Returns listings in a format compatible with PropertyWebBuilder,
  # converting each {Listing} to a {PwbListing} before serialization.
  class Api::V1::ListingsController < ApplicationController
    # Retrieves a property by URL and returns it as a PwbListing JSON array.
    #
    # Expects a +url+ query parameter. Returns error JSON when the URL
    # is missing, invalid, or belongs to an unsupported host.
    #
    # @return [void]
    def retrieve

      unless params["url"]
        return render json: {
          success: false,
          error_message: "Please provide a url"
        }
      end
      uri = uri_from_url params["url"].strip
      unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
        return render json: {
          success: false,
          error_message: "Please provide a valid url"
        }
      end
      import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
      unless import_host
        return render json: {
          success: false,
          error_message: "Sorry, the url provided is currently not supported"
        }
      end
      web_scraper = PropertyWebScraper::Scraper.new(import_host.scraper_name)
      listing = web_scraper.process_url uri.to_s, import_host

      pwb_listing = PropertyWebScraper::PwbListing.find listing.id

      # currently only 1 listing will be returned but in the future
      # where a page contains other listings, a urls_remaining number
      # will indicate how many more listings remain to be retrieved.
      # The retry_duration will indicate how long the client needs to wait before making
      # call.
      # On each call, an extra listing will be added
      render json: {
        success: true,
        retry_duration: 0,
        urls_remaining: 0,
        listings: [
          pwb_listing
        ]
      }
    end

  end
end
