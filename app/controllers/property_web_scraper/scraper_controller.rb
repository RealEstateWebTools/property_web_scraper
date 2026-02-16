module PropertyWebScraper
  # Main web controller for the scraper UI and JSON endpoints.
  #
  # Provides a welcome page, a config endpoint for the Chrome extension,
  # a JSON retrieval endpoint, and an AJAX form submission handler.
  class ScraperController < ApplicationController
    MIN_CLIENT_ID_LENGTH = 5

    # below to avoid ActionController::InvalidAuthenticityToken error when posting from chrome extension
    protect_from_forgery with: :null_session
    before_action :authenticate_api_key!, only: [:retrieve_as_json, :config_as_json]

    # Renders the scraper welcome/landing page.
    #
    # @return [void]
    def welcome
    end

    # Returns the scraper configuration for realtor.com as JSON.
    #
    # Used by the Chrome extension to understand which fields to extract.
    #
    # @return [void]
    def config_as_json
      import_host = PropertyWebScraper::ImportHost.find_by_host(params[:host] || "www.realtor.com")
      unless import_host.present?
        return render json: {
          success: false,
          key: "import_host"
        }
      end

      scraper_mapping = PropertyWebScraper::ScraperMapping.find_by_name(import_host.scraper_name)
      unless scraper_mapping.present?
        return render json: {
          success: false,
          key: "scraper_mapping"
        }
      end

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

    # Retrieves a property listing by URL and returns it as JSON.
    #
    # Expects a +url+ parameter. Returns error JSON when the URL is
    # missing, invalid, or belongs to an unsupported host.
    #
    # @return [void]
    def retrieve_as_json
      Rails.logger.info "PropertyWebScraper: retrieve_as_json called with url=#{params['url']}"
      validation = PropertyWebScraper::UrlValidator.call(params["url"])
      unless validation.valid?
        return render json: {
          success: false,
          error_message: validation.error_message
        }
      end
      uri = validation.uri
      import_host = validation.import_host
      if params["client_id"] && (params["client_id"].length > MIN_CLIENT_ID_LENGTH)
        client_id = params["client_id"]
      else
        client_id = "pwb" + SecureRandom.urlsafe_base64(8)
      end
      html = extract_html_input
      web_scraper = PropertyWebScraper::Scraper.new(import_host.scraper_name)
      @listing = web_scraper.process_url uri.to_s, import_host, html: html

      render json: {
        success: true,
        client_id: client_id,
        listing: @listing
      }
    end

    # Handles the AJAX form submission from the scraper UI.
    #
    # Delegates to {ListingRetriever} and renders a JS partial with the
    # result or error message.
    #
    # @return [void]
    def ajax_submit
      import_url = params[:import_url].strip
      html = extract_html_input

      listing_retriever = PropertyWebScraper::ListingRetriever.new(import_url, html: html)
      result = listing_retriever.retrieve
      if result.success
        @success = result.success
        @listing = result.retrieved_listing
        @image_urls = result.retrieved_listing.image_urls || []
        @listing_attributes = %w(reference title description
                                   price_string price_float area_unit address_string currency
                                   country longitude latitude main_image_url for_rent for_sale
                                   count_bedrooms count_bathrooms )
      else
        @error_message = result.error_message
      end

      render 'ajax_submit', layout: false
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

  end
end
