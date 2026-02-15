module PropertyWebScraper
  # Maps a website hostname to its scraper configuration.
  #
  # Each record links a real estate website (e.g. +www.idealista.com+)
  # to the JSON scraper mapping that knows how to parse its pages.
  #
  # @example Looking up a host
  #   host = ImportHost.find_by_host('www.idealista.com')
  #   scraper = Scraper.new(host.scraper_name)
  class ImportHost < ApplicationRecord
    # Returns the full HTTP URL for this host.
    #
    # @return [String] the URL, e.g. +"http://www.idealista.com"+
    def host_url
      "http://#{host}"
    end

    # TODO - use valid_url_regex to decide if url is valid for current import host
    #   - also use pause_between_calls + last_retrieval_at to decide
    # when to hit server again

    # Returns how long a cached listing is considered fresh.
    #
    # Reads from the +stale_age+ database column, defaulting to +"1.day"+.
    #
    # @return [ActiveSupport::Duration]
    def stale_age_duration
      duration_string = self.stale_age.presence || "1.day"
      duration_parts = duration_string.split('.')
      duration_parts.first.to_i.send(duration_parts.last)
    end
  end
end
