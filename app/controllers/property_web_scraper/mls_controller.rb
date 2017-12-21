require_dependency 'property_web_scraper/application_controller'

module PropertyWebScraper
  class MlsController < ApplicationController

    def welcome
      # @scraper_configs_coll = PropertyWebScraper::ImportHost.all
    end


    def ajax_submit

      # [:username, :password, :login_url, :mls_unique_name].each do |param_name|
      #   unless params[param_name].present?
      #     return render json: { error: "Please provide #{param_name}."}, status: 422
      #   end
      # end

      limit = 5
      listings_retriever = PropertyWebScraper::MlsListingsRetriever.new(import_source)
      properties = listings_retriever.retrieve("(ListPrice=0+)", limit)





      render '/property_web_scraper/mls_retrieve_results.js.erb', layout: false
    end

  end
end
