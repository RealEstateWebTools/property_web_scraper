module PropertyWebScraper
  # Base controller for all PropertyWebScraper controllers.
  class ApplicationController < ActionController::Base
    protect_from_forgery with: :exception

    private

    # Extracts HTML input from params.
    #
    # Supports two sources: an uploaded file (+html_file+) or a string
    # parameter (+html+). File upload takes precedence.
    #
    # @return [String, nil] the HTML string, or nil if not provided
    def extract_html_input
      if params[:html_file].present?
        params[:html_file].read
      elsif params[:html].present?
        params[:html]
      end
    end

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
