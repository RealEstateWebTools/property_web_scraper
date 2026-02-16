require 'nokogiri'
require 'open-uri'
require 'faraday'

module PropertyWebScraper
  # Fetches and parses property data from real estate websites.
  #
  # Uses a {ScraperMapping} JSON configuration to know which CSS selectors,
  # XPath expressions, or regex patterns to apply when extracting fields
  # from an HTML page.
  #
  # For JS-rendered sites, callers should provide pre-rendered HTML via
  # the +html:+ keyword parameter. Direct HTTP fetching via open-uri is
  # retained as a fallback for static sites.
  #
  # @example Scraping a single URL (legacy fetch)
  #   scraper = Scraper.new('idealista')
  #   listing = scraper.process_url(url, import_host)
  #
  # @example Extracting from pre-rendered HTML
  #   scraper = Scraper.new('idealista')
  #   listing = scraper.process_url(url, import_host, html: rendered_html)
  class Scraper
    attr_accessor :scraper_mapping

    # Initializes the scraper with a mapping configuration.
    #
    # @param scraper_mapping_name [String, nil] name used to look up the mapping via ScraperMapping.find_by_name
    # @param scraper_mapping [ScraperMapping, nil] pre-loaded mapping object (takes precedence)
    # @raise [ArgumentError] if no valid mapping can be found
    def initialize(scraper_mapping_name, scraper_mapping=nil)
      if scraper_mapping.present?
        self.scraper_mapping = scraper_mapping
      else
        self.scraper_mapping = PropertyWebScraper::ScraperMapping.find_by_name(scraper_mapping_name)
        raise ArgumentError, 'Not valid scraper' if self.scraper_mapping.blank?
      end
    end

    # Retrieves or refreshes a listing for the given URL.
    #
    # Finds an existing listing by +import_url+ or creates one. If the
    # listing is older than the import host's +stale_age_duration+ it is
    # re-scraped from the source website.
    #
    # @param import_url [String] the property page URL
    # @param import_host [ImportHost] the host record for this URL
    # @param html [String, nil] pre-rendered HTML; when provided, skips HTTP fetch
    # @return [Listing] the persisted listing
    def process_url(import_url, import_host, html: nil)
      Rails.logger.info "PropertyWebScraper: Scraping #{import_url} (host: #{import_host.slug})"
      start_time = Time.current
      listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
      expiry_duration = import_host.stale_age_duration
      # For datetime, yesterday is < today
      recent = (DateTime.now.utc - expiry_duration)

      listing_retrieved_recently = listing.last_retrieved_at.present? && (listing.last_retrieved_at > recent)

      if listing.last_retrieved_at.blank? || !listing_retrieved_recently
        # if listing has not been retrieved within time defined by stale age
        # retrieve from source rather than db
        retrieve_and_save listing, import_host.slug, html: html
        import_host.last_retrieval_at = DateTime.now
        import_host.save!
      end
      Rails.logger.info "PropertyWebScraper: Completed scraping #{import_url} in #{(Time.current - start_time).round(2)}s"
      listing
    end

    # Scrapes the listing page and persists the extracted data.
    #
    # @param listing [Listing] the listing to update
    # @param import_host_slug [String] slug identifying the import host
    # @param html [String, nil] pre-rendered HTML; when provided, skips HTTP fetch
    # @return [Listing] the updated listing
    def retrieve_and_save(listing, import_host_slug, html: nil)
      if html
        result = HtmlExtractor.call(
          html: html,
          source_url: listing.import_url,
          scraper_mapping: scraper_mapping
        )
        retrieved_properties = result[:properties]
      else
        retrieved_properties = fetch_and_extract(listing.import_url)
      end
      listing.import_host_slug = import_host_slug
      listing.last_retrieved_at = DateTime.now
      Listing.update_from_hash listing, retrieved_properties[0]

      listing
    end

    # Fetches and parses an HTML page into a property hash.
    #
    # This is the legacy path that fetches HTML directly via open-uri.
    # For JS-rendered sites, provide pre-rendered HTML via the +html:+
    # keyword on {#process_url} or {#retrieve_and_save} instead.
    #
    # @param import_url [String] the URL to fetch
    # @return [Array<Hash>] array containing a single property hash
    def retrieve_from_webpage(import_url)
      Rails.logger.info "PropertyWebScraper: Fetching page #{import_url}"
      fetch_and_extract(import_url)
    end

    private

    # Fetches HTML via open-uri and delegates extraction to HtmlExtractor.
    #
    # @param import_url [String] the URL to fetch
    # @return [Array<Hash>] array containing a single property hash
    def fetch_and_extract(import_url)
      Rails.logger.warn "PropertyWebScraper: Direct HTTP fetch is a fallback. For JS-rendered sites, provide pre-rendered HTML."

      uri = URI.parse(import_url)
      tries = 3

      begin
        page_to_parse = uri.open(redirect: false)
      rescue OpenURI::HTTPRedirect => redirect
        uri = redirect.uri
        Rails.logger.warn "PropertyWebScraper: Redirect to #{uri} (#{3 - tries + 1} of 3)"
        retry if (tries -= 1) > 0
        raise
      end
      html = page_to_parse.read
      doc = Nokogiri::HTML(html)
      Rails.logger.info "PropertyWebScraper: Parsed document size: #{doc.to_s.bytesize} bytes"

      result = HtmlExtractor.call(
        html: html,
        source_url: import_url,
        scraper_mapping: scraper_mapping
      )
      result[:properties]
    end
  end
end
