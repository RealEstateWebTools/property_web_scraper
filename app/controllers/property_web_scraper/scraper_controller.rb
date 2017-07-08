require_dependency 'property_web_scraper/application_controller'

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
      unless params[:import_url].present?
        return render json: { error: 'Please provide url.' }, status: 422
      end
      import_url = params[:import_url]

      # TODO: - a check to avoid retrieving if saved listing is up to date

      @import_host = PropertyWebScraper::ImportHost.find_by(id: params[:id])
      @import_host.last_retrieval_at = DateTime.now
      @import_host.save!
      web_scraper = PropertyWebScraper::Scraper.new(@import_host.scraper_name)

      listing = web_scraper.retrieve_and_save import_url, @import_host.id
      render json: listing.as_json

      # render json: {
      #   success: true
      # }
    end
  end
end
