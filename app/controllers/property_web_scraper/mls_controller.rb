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
      mls_name = params[:mls_unique_name] || "mris"
      import_source = PropertyWebScraper::MlsImportSource.find_by_unique_name mls_name

      # import_source.details[:username] = params[:username]
      import_source.details[:password] = params[:password]||'PMRISTEST'
      # import_source.details[:login_url] = params[:login_url]

      limit = 25
      properties = PropertyWebScraper::MlsListingsRetriever.new(import_source).retrieve("(ListPrice=0+)", limit)
      retrieved_properties = []
      count = 0
      # return render json: properties.as_json

      properties.each do |property|
        if count < 100
          mapped_property = ImportMapper.new(import_source.import_mapper_name).map_property(property)
          retrieved_properties.push mapped_property
        end
        count += 1
      end

      # render json: retrieved_properties



      render '/property_web_scraper/mls_retrieve_results.js.erb', layout: false
    end

  end
end
