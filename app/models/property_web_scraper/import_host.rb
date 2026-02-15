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
    # Currently hard-coded to 1 day. Future versions will read from the
    # +stale_age+ database column.
    #
    # @return [ActiveSupport::Duration]
    def stale_age_duration
      duration_string = "1.day"
      # self.stale_age || "1.day"
      # https://stackoverflow.com/questions/34506174/convert-string-to-activesupportduration
      duration_parts = duration_string.split('.')
      duration_parts.first.to_i.send(duration_parts.last)
    end
  end
end
