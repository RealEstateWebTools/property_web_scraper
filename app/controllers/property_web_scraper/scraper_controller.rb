require_dependency "property_web_scraper/application_controller"

module PropertyWebScraper
  class ScraperController < ApplicationController
    def retrieve
      render json: {
        success: true
      }
    end
  end
end
