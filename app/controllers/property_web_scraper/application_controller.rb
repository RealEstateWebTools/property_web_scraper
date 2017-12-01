module PropertyWebScraper
  class ApplicationController < ActionController::Base
    protect_from_forgery with: :exception

    private

    def uri_from_url import_url
      begin
        uri = URI.parse import_url
      rescue URI::InvalidURIError => error
        uri = ""
      end
    end
  end
end
