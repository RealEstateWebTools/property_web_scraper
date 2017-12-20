require_dependency 'property_web_scraper/application_controller'

module PropertyWebScraper
  class MlsController < ApplicationController

    def welcome
      # @scraper_configs_coll = PropertyWebScraper::ImportHost.all
    end


    def ajax_submit
      # scraper_name = params[:scraper][:scraper_name]
      import_url = params[:import_url].strip

      listing_retriever = PropertyWebScraper::ListingRetriever.new(import_url)
      result = listing_retriever.retrieve
      if result.success
        @success = result.success
        @listing = result.retrieved_listing
        @image_urls = result.retrieved_listing.image_urls || []
        @listing_attributes = %w(reference title description
                                   price_string price_float area_unit address_string currency
                                   country longitude latitude main_image_url for_rent for_sale
                                   count_bedrooms count_bathrooms )
        # above used to display /views/property_web_scraper/scraper/_retrieve_results.html.erb
      else
        @error_message = result.error_message
      end

      render '/property_web_scraper/mls_retrieve_results.js.erb', layout: false
    end

  end
end
