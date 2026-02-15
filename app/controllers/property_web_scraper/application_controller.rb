module PropertyWebScraper
  # Base controller for all PropertyWebScraper controllers.
  class ApplicationController < ActionController::Base
    protect_from_forgery with: :exception

    private

    # Authenticates API requests via the PROPERTY_SCRAPER_API_KEY env var.
    #
    # When the env var is unset, authentication is skipped (backwards
    # compatible). Otherwise checks the +X-Api-Key+ header first, then
    # falls back to the +api_key+ query parameter.
    def authenticate_api_key!
      expected_key = ENV['PROPERTY_SCRAPER_API_KEY']
      return if expected_key.blank?

      provided_key = request.headers['X-Api-Key'].presence || params[:api_key].to_s
      unless provided_key.present? && ActiveSupport::SecurityUtils.secure_compare(provided_key, expected_key)
        render json: { success: false, error_message: "Unauthorized" }, status: :unauthorized
      end
    end
  end
end
