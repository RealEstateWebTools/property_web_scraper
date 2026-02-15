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
  # @example Scraping a single URL
  #   scraper = Scraper.new('idealista')
  #   listing = scraper.process_url(url, import_host)
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
    # @return [Listing] the persisted listing
    def process_url(import_url, import_host)
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
        retrieve_and_save listing, import_host.slug
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
    # @return [Listing] the updated listing
    def retrieve_and_save(listing, import_host_slug)
      retrieved_properties = retrieve_from_webpage listing.import_url
      listing.import_host_slug = import_host_slug
      listing.last_retrieved_at = DateTime.now
      Listing.update_from_hash listing, retrieved_properties[0]

      listing
    end

    # Fetches and parses an HTML page into a property hash.
    #
    # Applies the scraper mapping's CSS/XPath/regex rules to extract
    # text fields, numeric fields, boolean fields, images, and features.
    #
    # @param import_url [String] the URL to fetch
    # @return [Array<Hash>] array containing a single property hash
    def retrieve_from_webpage(import_url)
      Rails.logger.info "PropertyWebScraper: Fetching page #{import_url}"
      properties = []
      # nov 2017 - only 1 property is ever returned currently

      property_hash = {}

      # Fetch and parse HTML document
      uri = URI.parse(import_url)
      tries = 3

      # redirects are sometimes legitimate but could also be used
      # to hack site so need to stop after a few tries
      # https://stackoverflow.com/questions/27407938/ruby-open-uri-redirect-forbidden
      # https://twin.github.io/improving-open-uri/
      begin
        page_to_parse = uri.open(redirect: false)
        # page_to_parse = open(import_url)
      rescue OpenURI::HTTPRedirect => redirect
        uri = redirect.uri # assigned from the "Location" response header
        Rails.logger.warn "PropertyWebScraper: Redirect to #{uri} (#{3 - tries + 1} of 3)"
        retry if (tries -= 1) > 0
        raise
      end
      doc = Nokogiri::HTML(page_to_parse)
      Rails.logger.info "PropertyWebScraper: Parsed document size: #{doc.to_s.bytesize} bytes"

      if scraper_mapping.defaultValues
        scraper_mapping.defaultValues.keys.each do |mapping_key|
          mapping = scraper_mapping.defaultValues[mapping_key]
          property_hash[mapping_key] = mapping['value']
        end
      end

      if scraper_mapping.images
        scraper_mapping.images.each do |image_mapping|
          # TODO: make this function useful for where there are multiple selectors / mappings
          # for images.  Right now it works for only one selector which matches multiple items
          retrieved_array = retrieve_images_array doc, image_mapping, uri
          property_hash["image_urls"] = retrieved_array
        end
      end

      if scraper_mapping.features
        scraper_mapping.features.each do |feature_mapping|
          # TODO: make this function useful for where there are multiple selectors / mappings
          # for features.  Right now it works for only one selector which matches multiple items
          retrieved_array = retrieve_features_array doc, feature_mapping, uri
          property_hash["features"] = retrieved_array
        end
      end

      if scraper_mapping.intFields
        scraper_mapping.intFields.keys.each do |mapping_key|
          mapping = scraper_mapping.intFields[mapping_key]
          retrieved_text = retrieve_target_text doc, mapping, uri
          property_hash[mapping_key] = retrieved_text.strip.to_i
        end
      end

      if scraper_mapping.floatFields
        scraper_mapping.floatFields.keys.each do |mapping_key|
          mapping = scraper_mapping.floatFields[mapping_key]
          retrieved_text = retrieve_target_text doc, mapping, uri
          # if mapping['comaToDot']
          #   retrieved_text = retrieved_text.strip.tr(',', '.')
          # end
          if mapping['stripPunct']
            retrieved_text = retrieved_text.tr('.', '').tr(',', '')
          end
          if mapping['stripFirstChar']
            retrieved_text = retrieved_text.strip[1..] || ''
          end
          property_hash[mapping_key] = retrieved_text.strip.to_f
        end
      end

      if scraper_mapping.textFields
        scraper_mapping.textFields.keys.each do |mapping_key|
          mapping = scraper_mapping.textFields[mapping_key]
          retrieved_text = retrieve_target_text doc, mapping, uri
          property_hash[mapping_key] = retrieved_text.strip
        end
      end

      if scraper_mapping.booleanFields
        scraper_mapping.booleanFields.keys.each do |mapping_key|
          mapping = scraper_mapping.booleanFields[mapping_key]
          retrieved_text = retrieve_target_text doc, mapping, uri
          evaluator_text = mapping['evaluatorParam']

          if mapping['caseInsensitive']
            retrieved_text = retrieved_text.downcase
            evaluator_text = evaluator_text.downcase
          end

          # target_element = doc.css(mapping["cssLocator"])[mapping["cssCountId"].to_i] || ""
          property_hash[mapping_key] = retrieved_text.strip.send(mapping['evaluator'], evaluator_text)
        end
      end

      properties.push property_hash
      properties
    end

    private

    def retrieve_features_array(doc, mapping, uri)
      retrieved_array = []
      if mapping['cssLocator'].present?
        css_elements = doc.css(mapping['cssLocator'])
        css_elements.each do |element|
          feature_text = get_text_from_css element, mapping
          retrieved_array.push feature_text
        end
      end

      # TODO - support xpath for features
      # if mapping['xpath'].present?
      #   css_elements = doc.css(mapping['xpath'])
      #   css_elements.each do |element|
      #     retrieved_array.push element.text
      #   end
      # end

      trimmed_and_stripped_array = []
      retrieved_array.each do |string_to_clean|
        cleaned_string = clean_up_string string_to_clean, mapping
        trimmed_and_stripped_array.push cleaned_string
        # string_to_clean.sub("_max_135x100", "")
      end
      trimmed_and_stripped_array
    end


    def retrieve_images_array(doc, mapping, uri)
      retrieved_array = []
      if mapping['cssLocator'].present?
        css_elements = doc.css(mapping['cssLocator'])
        css_elements.each do |element|
          # TODO - allow passing in of element to be evaluated
          # if mapping['cssAttr'] && element.attr(mapping['cssAttr'])
          #   img_url = element.attr(mapping['cssAttr'])
          # else
          #   img_url = element.text
          # end
          img_url = get_text_from_css element, mapping

          # ensure_url_is_absolute
          # TODO - move below into custom method
          img_uri = URI.parse(img_url)
          unless img_uri.host
            img_uri.scheme = uri.scheme
            img_uri.host = uri.host
            unless img_uri.path.start_with? "/"
              img_uri.path = "/" + img_uri.path
            end
            if mapping['imagePathPrefix'].present?
              # workaround for carusoimmobiliare with sucky url paths
              img_uri.path = mapping['imagePathPrefix'] + img_uri.path
            end
            img_url = img_uri.to_s
          end
          retrieved_array.push img_url
        end
      end

      if mapping['xpath'].present?
        css_elements = doc.xpath(mapping['xpath'])
        css_elements.each do |element|
          retrieved_array.push element.text
        end
      end
      trimmed_and_stripped_array = []
      retrieved_array.each do |string_to_clean|
        cleaned_string = clean_up_string string_to_clean, mapping
        trimmed_and_stripped_array.push cleaned_string
        # string_to_clean.sub("_max_135x100", "")
      end
      trimmed_and_stripped_array
    end

    def retrieve_target_text(doc, mapping, uri)
      retrieved_text = ''
      if mapping['scriptRegEx'].present?
        regex = Regexp.new mapping['scriptRegEx']
        # "longitude:[^\,]*"
        # regex_results_array = doc.search("script").text.scan(regex) || [""]
        retrieved_text = doc.search("script").text.scan(regex)[0] || ""
        # retrieved_text = retrieved_text.split("\"")[1] || ""
      end
      if mapping['urlPathPart'].present?
        url_path_part = mapping['urlPathPart']
        retrieved_text = get_text_from_url url_path_part, uri
      end
      if mapping['cssLocator'].present?
        css_elements = doc.css(mapping['cssLocator'])
        retrieved_text = get_text_from_css css_elements, mapping
      end
      if mapping['xpath'].present?
        css_elements = doc.xpath(mapping['xpath'])
        # able to retrieve xpath just like with css
        # but in future this might change
        retrieved_text = get_text_from_css css_elements, mapping
      end
      retrieved_text = clean_up_string retrieved_text, mapping
    end

    def clean_up_string(string_to_clean, mapping)
      unless mapping['splitTextCharacter'].nil?
        # - cannot use .present? above as splitTextCharacter is sometimes " "
        # mapping["splitTextCharacter"].present?
        #
        # in this case the element's text need to be split by the splitTextCharacter
        # splitTextArrayId refers to where in the resulting array
        # the correct item is
        begin
          splitTextCharacter = mapping['splitTextCharacter'] || ' '
          splitTextArrayId = mapping['splitTextArrayId'].to_i
          string_to_clean = string_to_clean.split(splitTextCharacter)[splitTextArrayId]
          # in case above returns nil
          string_to_clean = string_to_clean || ''
        rescue StandardError => e
          Rails.logger.error "PropertyWebScraper: clean_up_string failed: #{e.message}"
        end
      end
      if mapping['stripString'].present?
        string_to_clean = string_to_clean.sub(mapping['stripString'], "")
      end
      string_to_clean
    end

    def get_text_from_url(url_path_part, uri)
      url_retrieved_text = uri.path
      if url_path_part.to_i > 0
        url_retrieved_text = uri.path.split("/")[url_path_part.to_i]
      end
      url_retrieved_text
    end

    def get_text_from_css(css_elements, mapping)
      css_retrieved_text = css_elements.text
      if mapping['cssAttr'] && css_elements.attr(mapping['cssAttr'])
        css_retrieved_text = css_elements.attr(mapping['cssAttr']).text
      elsif mapping['xmlAttr'] && css_elements.attr(mapping['xmlAttr'])
        # xmlAttr for cases like idealister where element returned
        # is xml
        css_retrieved_text = css_elements.attr(mapping['xmlAttr'])
        # css_retrieved_text = css_elements.text
      end

      if mapping['cssCountId'].present?
        # in this case we have multiple elements matched
        # and the cssCountId refers to where in the list of matched elements
        # the correct item is
        begin
          css_count_id = mapping['cssCountId'].to_i
          css_retrieved_text = css_elements[css_count_id].text || ''
        rescue StandardError => e
          Rails.logger.error "PropertyWebScraper: get_text_from_css failed: #{e.message}"
        end
      end
      css_retrieved_text
    end
  end
end
