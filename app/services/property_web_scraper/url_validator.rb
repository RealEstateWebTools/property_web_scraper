module PropertyWebScraper
  # Validates and parses a URL for use with the scraper.
  #
  # Consolidates URL validation logic shared across controllers and
  # services: presence check, whitespace stripping, URI parsing,
  # HTTP(S) scheme check, and ImportHost lookup.
  #
  # @example
  #   result = UrlValidator.call("https://www.idealista.com/inmueble/123/")
  #   result.valid?       #=> true
  #   result.uri          #=> #<URI::HTTPS>
  #   result.import_host  #=> ImportHost
  class UrlValidator
    MISSING  = :missing
    INVALID  = :invalid
    UNSUPPORTED = :unsupported

    Result = Struct.new(:valid, :uri, :import_host, :error_message, :error_code, keyword_init: true) do
      alias_method :valid?, :valid
    end

    # Validates the given URL string.
    #
    # @param url [String, nil] the URL to validate
    # @return [Result]
    def self.call(url)
      if url.blank?
        return Result.new(valid: false, error_code: MISSING, error_message: "Please provide a url")
      end

      stripped = url.strip
      uri = begin
        URI.parse(stripped)
      rescue URI::InvalidURIError
        nil
      end

      unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
        return Result.new(valid: false, error_code: INVALID, error_message: "Please provide a valid url")
      end

      import_host = ImportHost.find_by_host(uri.host)
      unless import_host
        return Result.new(valid: false, error_code: UNSUPPORTED, error_message: "Sorry, the url provided is currently not supported")
      end

      Result.new(valid: true, uri: uri, import_host: import_host)
    end
  end
end
