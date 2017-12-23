require_dependency 'property_web_scraper/application_controller'

module PropertyWebScraper
  class MlsController < ApplicationController

    def welcome
      @import_source = PropertyWebScraper::MlsImportSource.find_by_slug params[:mls_slug]
      if @import_source.blank?
        @import_sources = PropertyWebScraper::MlsImportSource.all
        @error_message = "MLS not supported"
      else
        @login_url = @import_source.details[:login_url]
      end
    end

    def ajax_submit

      [:username, :password, :login_url, :slug].each do |param_name|
        unless params[param_name].present?
          @success = false
          @error_message = "Please provide #{param_name}."
          return render '/property_web_scraper/mls_retrieve_results.js.erb', layout: false

          # return render json: { error: "Please provide #{param_name}."}, status: 422
        end
      end

      limit = 5
      mls_slug = params[:slug]
      retriever = PropertyWebScraper::MlsListingsRetriever.new(mls_slug, params[:password])
      result = retriever.retrieve("(ListPrice=0+)", limit)
      @success = result.success
      if result.success
        @properties = result.properties
      else
        @error_message = result.error_message
      end

      render '/property_web_scraper/mls_retrieve_results.js.erb', layout: false
    end

  end
end
