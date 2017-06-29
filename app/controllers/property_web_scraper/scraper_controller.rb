require_dependency "property_web_scraper/application_controller"

module PropertyWebScraper
  class ScraperController < ApplicationController

    def submit
      scraper_name = params[:scraper][:scraper_name]
      redirect_to "/scrapers/#{scraper_name}"
    end

    def show
      @import_host = PropertyWebScraper::ImportHost.find_by(id: params[:id])

      @import_host_listings = PropertyWebScraper::Listing.where(import_host_id: @import_host.id)

    end

    def welcome
      @scraper_configs_coll = PropertyWebScraper::ImportHost.all

    end

    def retrieve

      unless params[:source_url].present?
        return render json: { error: "Please provide url."}, status: 422
      end
      source_url = params[:source_url]

      listing = PropertyWebScraper::Listing.where(import_url: source_url).first_or_create

      # TODO - a check to avoid retrieving if saved listing is up to date


      @import_host = PropertyWebScraper::ImportHost.find_by(id: params[:id])
      web_scraper = PropertyWebScraper::Scraper.new(@import_host.scraper_name)
      retrieved_properties = web_scraper.retrieve_from_webpage source_url

      # TODO - move below to listing model and save retrieval history
      listing.reference = retrieved_properties[0]["reference"]
      listing.title = retrieved_properties[0]["title"]
      listing.description = retrieved_properties[0]["description"]
      listing.price = retrieved_properties[0]["price"]
      listing.constructed_area = retrieved_properties[0]["constructed_area"] || 0
      listing.count_bedrooms = retrieved_properties[0]["count_bedrooms"] || 0
      listing.count_bathrooms = retrieved_properties[0]["count_bathrooms"] || 0
      listing.import_host_id = @import_host.id

      listing.save!

      render json: retrieved_properties


      # render json: {
      #   success: true
      # }
    end
  end
end
