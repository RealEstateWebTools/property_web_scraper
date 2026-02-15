module PropertyWebScraper
  # Renders a single property page.
  #
  # Fetches a listing by URL, builds map marker data, and renders
  # the show template.
  class SinglePropertyViewController < ApplicationController
    # Displays a single scraped property with map and images.
    #
    # Expects a +url+ query parameter. Renders an error view when the
    # URL is missing, invalid, or belongs to an unsupported host.
    #
    # @return [void]
    def show
      import_url = params[:url] || ""
      uri = uri_from_url(import_url.strip)
      @listing = {}
      if uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
        # find import_host with meta data from db
        import_host = PropertyWebScraper::ImportHost.find_by_host(uri.host)
        if import_host
          @success = true
          web_scraper = PropertyWebScraper::Scraper.new(import_host.scraper_name)
          begin
            @listing = web_scraper.process_url import_url, import_host
          rescue OpenURI::HTTPError => e
            @error_message = "Could not retrieve property: the website returned #{e.message}"
            return render '/property_web_scraper/single_property_view/error', layout: false
          rescue StandardError => e
            @error_message = "Could not retrieve property: #{e.message}"
            return render '/property_web_scraper/single_property_view/error', layout: false
          end

          @markers = []

          if @listing.latitude.present? && @listing.longitude.present?
            title = @listing.title || ""
            marker = {
              title: title,
              show_url: "#",
              image_url: nil,
              display_price: "",
              position: {
                lat: @listing.latitude,
                lng: @listing.longitude
              }
            }
            @markers.push marker
          end

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
      @main_image_url = "https://placehold.co/500x250?text=No+Image"
      if @listing.image_urls.present?
        @main_image_url = @listing.image_urls[0]
      end

      render '/property_web_scraper/single_property_view/show'
    end
  end
end
