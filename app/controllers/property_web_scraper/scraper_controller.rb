require_dependency 'property_web_scraper/application_controller'

module PropertyWebScraper
  class ScraperController < ApplicationController
    # below to avoid ActionController::InvalidAuthenticityToken error when posting from chrome extension
    protect_from_forgery with: :null_session
    # def show
    #   import_host = PropertyWebScraper::ImportHost.find_by(id: params[:id])

    #   import_host_listings = PropertyWebScraper::Listing.where(import_host_id: import_host.id)
    # end

    # def retrieve
    #   unless params[:import_url].present?
    #     return render json: { error: 'Please provide url.' }, status: 422
    #   end
    #   import_url = params[:import_url].strip
    #   import_host = PropertyWebScraper::ImportHost.find_by(id: params[:id])

    #   web_scraper = PropertyWebScraper::Scraper.new(import_host.scraper_name)
    #   listing = web_scraper.process_url import_url, import_host

    #   render json: listing.as_json

    #   # render json: {
    #   #   success: true
    #   # }
    # end

    def welcome
      # @scraper_configs_coll = PropertyWebScraper::ImportHost.all
    end

    def config_as_json
      import_host = PropertyWebScraper::ImportHost.find_by_host("www.realtor.com")
      unless import_host.present?
        return render json: {
          success: false,
          key: "import_host"
        }
      end

      scraper_mapping = PropertyWebScraper::ScraperMapping.find_by_name(import_host.scraper_name)

      config = []
      config += (reform_config scraper_mapping.attributes[:defaultValues])
      config += (reform_config scraper_mapping.attributes[:textFields])
      config += (reform_config scraper_mapping.attributes[:booleanFields])
      config += (reform_config scraper_mapping.attributes[:floatFields])
      config += (reform_config scraper_mapping.attributes[:intFields])
      config += (reform_config scraper_mapping.attributes[:extraFields])

      render json: {
        success: true,
        key: import_host.host,
        config: config
      }
    end

    def retrieve_as_json

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
      if params["client_id"] && (params["client_id"].length > 5)
        client_id = params["client_id"]
      else
        client_id = "pwb" + SecureRandom.urlsafe_base64(8)
      end
      web_scraper = PropertyWebScraper::Scraper.new(import_host.scraper_name)
      @listing = web_scraper.process_url uri.to_s, import_host

      fb_instance_id = Rails.application.secrets.fb_instance_id
      base_uri = "https://#{fb_instance_id}.firebaseio.com/"
      firebase = Firebase::Client.new(base_uri)

      response = firebase.push("client-props/#{client_id}", @listing)

      @props_hash = response.body
      # byebug

      render json: {
        success: true,
        client_id: client_id,
        listing: @listing
      }
    end

    def ajax_submit
      # scraper_name = params[:scraper][:scraper_name]
      import_url = params[:import_url].strip
      begin
        uri = URI.parse import_url
      rescue URI::InvalidURIError => error
        uri = ""
      end
      @listing = {}
      if uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
        # find import_host with meta data from db
        import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
        if import_host
          @success = true
          web_scraper = PropertyWebScraper::Scraper.new(import_host.scraper_name)
          @listing = web_scraper.process_url import_url, import_host
          @listing_attributes = %w(reference title description
                                   price_string price_float area_unit address_string currency
                                   country longitude latitude main_image_url for_rent for_sale
                                   count_bedrooms )
          # above used to display /views/property_web_scraper/scraper/_retrieve_results.html.erb
        else
          @success = false
          @error_message = <<-HTML
          <div class="error">
          Sorry, unable to retrieve property details from this url.
            Please try a url from
          <span><a href="https://www.idealista.com">
          https://www.idealista.com</a></span>
          <span><a href="http://www.mlslistings.com">
          http://www.mlslistings.com</a></span>
          <span><a href="http://www.realtor.com">
          http://www.realtor.com</a></span>
          or
          <span><a href="https://www.zoopla.co.uk">
          https://www.zoopla.co.uk</a></span>
          </div>
          HTML

        end
      else
        @error_message = 'Please enter a valid url'
        @success = false
      end
      # redirect_to "/scrapers/#{scraper_name}"
      render '/property_web_scraper/retrieve_results.js.erb', layout: false
    end

    private

    def reform_config scraper_mapping_attributes
      unless scraper_mapping_attributes
        return []
      end
      config = scraper_mapping_attributes.map do |field|
        {"parseInfo" => field[1],"name" => field[0]}
        # {field[0] => field[1], field[0] => field[1]}
      end
    end

    def uri_from_url import_url
      begin
        uri = URI.parse import_url
      rescue URI::InvalidURIError => error
        uri = ""
      end
    end

  end
end
