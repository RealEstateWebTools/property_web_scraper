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
      Rails.logger.info "PropertyWebScraper: SinglePropertyView#show called with url=#{import_url}"
      validation = PropertyWebScraper::UrlValidator.call(import_url)
      @listing = {}
      unless validation.valid?
        @error_message = validation.error_message
        return render '/property_web_scraper/single_property_view/error', layout: false
      end

      import_host = validation.import_host
      @success = true
      html = extract_html_input
      web_scraper = PropertyWebScraper::Scraper.new(import_host.scraper_name)
      begin
        @listing = web_scraper.process_url import_url.strip, import_host, html: html
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
      @main_image_url = "https://placehold.co/500x250?text=No+Image"
      if @listing.image_urls.present?
        @main_image_url = @listing.image_urls[0]
      end

      render '/property_web_scraper/single_property_view/show'
    end
  end
end
