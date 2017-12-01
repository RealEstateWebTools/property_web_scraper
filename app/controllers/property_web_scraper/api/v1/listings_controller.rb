require_dependency "property_web_scraper/application_controller"

module PropertyWebScraper
  class Api::V1::ListingsController < ApplicationController
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
      # if params["client_id"] && (params["client_id"].length > 5)
      #   client_id = params["client_id"]
      # else
      #   client_id = "pwb" + SecureRandom.urlsafe_base64(8)
      # end
      web_scraper = PropertyWebScraper::Scraper.new(import_host.scraper_name)
      listing = web_scraper.process_url uri.to_s, import_host

      pwb_listing = PropertyWebScraper::PwbListing.find listing.id


      # fb_instance_id = Rails.application.secrets.fb_instance_id
      # base_uri = "https://#{fb_instance_id}.firebaseio.com/"
      # firebase = Firebase::Client.new(base_uri)
      # response = firebase.push("client-props/#{client_id}", pwb_listing)
      # @props_hash = response.body

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
