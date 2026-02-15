module PropertyWebScraper
  # Maps a website hostname to its scraper configuration.
  #
  # Each record links a real estate website (e.g. +www.idealista.com+)
  # to the JSON scraper mapping that knows how to parse its pages.
  # Document ID is the +slug+ field (natural key).
  #
  # @example Looking up a host
  #   host = ImportHost.find_by_host('www.idealista.com')
  #   scraper = Scraper.new(host.scraper_name)
  class ImportHost < ApplicationRecord
    firestore_collection :import_hosts
    document_id_field :slug

    attribute :scraper_name, :string
    attribute :host, :string
    attribute :slug, :string
    attribute :is_https, :boolean, default: false
    attribute :details, :hash, default: {}
    attribute :example_urls, :array, default: []
    attribute :invalid_urls, :array, default: []
    attribute :last_retrieval_at, :datetime
    attribute :valid_url_regex, :string
    attribute :pause_between_calls, :string, default: '5.seconds'
    attribute :stale_age, :string, default: '1.day'

    # Returns the full HTTP URL for this host.
    #
    # @return [String] the URL, e.g. +"http://www.idealista.com"+
    def host_url
      "http://#{host}"
    end

    # Returns how long a cached listing is considered fresh.
    #
    # Reads from the +stale_age+ attribute, defaulting to +"1.day"+.
    #
    # @return [ActiveSupport::Duration]
    def stale_age_duration
      duration_string = self.stale_age.presence || "1.day"
      duration_parts = duration_string.split('.')
      duration_parts.first.to_i.send(duration_parts.last)
    end
  end
end
