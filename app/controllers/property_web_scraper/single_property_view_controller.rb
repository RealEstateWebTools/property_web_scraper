require_dependency 'property_web_scraper/application_controller'

module PropertyWebScraper
  class SinglePropertyViewController < ApplicationController
    # below to avoid ActionController::InvalidAuthenticityToken error when posting from chrome extension
    # protect_from_forgery with: :null_session

    def show
      # scraper_name = params[:scraper][:scraper_name]
      import_url = params[:url] || ""
      begin
        uri = URI.parse import_url.strip
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
                                   count_bedrooms count_bathrooms )
          # above used to display /views/property_web_scraper/scraper/_retrieve_results.html.erb
        else
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
          return render '/property_web_scraper/single_property_view/error', layout: false
        end
      else
        @error_message = 'Url is not valid'
        return render '/property_web_scraper/single_property_view/error', layout: false
      end
      render '/property_web_scraper/single_property_view/show', layout: "property_web_scraper/spp_modern"
    end

    private



  end
end
