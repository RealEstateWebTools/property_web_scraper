require_dependency "property_web_scraper/application_controller"

module PropertyWebScraper
  class ScraperController < ApplicationController

    def submit
      scraper_name = params[:scraper][:scraper_name]
      redirect_to "/scrapers/#{scraper_name}"
    end

    def show
      @scraper_name = params[:scraper_name]
    end

    def welcome
      @scraper_configs_coll = PropertyWebScraper::ScraperMapping.all
      
    end

    def retrieve

      unless params[:source_url].present?
        return render json: { error: "Please provide url."}, status: 422
      end
      source_url = params[:source_url]

      web_scraper = PropertyWebScraper::Scraper.new(params[:scraper_name])
      retrieved_properties = web_scraper.retrieve_from_webpage source_url

      render json: retrieved_properties


      # render json: {
      #   success: true
      # }
    end
  end
end
