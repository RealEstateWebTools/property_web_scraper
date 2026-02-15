module PropertyWebScraper
  # Base controller for all PropertyWebScraper controllers.
  class ApplicationController < ActionController::Base
    protect_from_forgery with: :exception

    private

    # Safely parses a URL string into a URI object.
    #
    # Returns +nil+ when the URL is malformed, allowing callers
    # to check +uri.is_a?(URI::HTTP)+ to detect failures.
    #
    # @param import_url [String] the URL to parse
    # @return [URI::HTTP, URI::HTTPS, nil] the parsed URI or +nil+ on failure
    def uri_from_url(import_url)
      URI.parse(import_url)
    rescue URI::InvalidURIError
      nil
    end
  end
end
