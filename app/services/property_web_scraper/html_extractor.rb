require 'nokogiri'

module PropertyWebScraper
  # Extracts structured property data from raw HTML using configurable mappings.
  #
  # This is a pure-function service with zero network I/O. It takes
  # fully-rendered HTML (from any source: Chrome extension, headless browser,
  # direct fetch) and returns structured property data.
  #
  # @example Extract from pre-rendered HTML
  #   result = HtmlExtractor.call(
  #     html: "<html>...</html>",
  #     source_url: "https://www.idealista.com/inmueble/123/",
  #     scraper_mapping_name: "idealista"
  #   )
  #   result[:properties].first["title"] #=> "Piso en venta..."
  #
  # @example Extract with a pre-loaded mapping
  #   mapping = ScraperMapping.find_by_name("rightmove")
  #   result = HtmlExtractor.call(
  #     html: page_html,
  #     source_url: url,
  #     scraper_mapping: mapping
  #   )
  class HtmlExtractor
    attr_reader :doc, :uri, :scraper_mapping

    # Main entry point.
    #
    # @param html [String] fully-rendered HTML
    # @param source_url [String] the original page URL (for relative URL resolution + URL-path extraction)
    # @param scraper_mapping_name [String, nil] override mapping name (default: auto-detect from source_url host)
    # @param scraper_mapping [ScraperMapping, nil] pre-loaded mapping object (takes precedence)
    # @return [Hash] { success: Boolean, properties: [Hash], error_message: String? }
    def self.call(html:, source_url:, scraper_mapping_name: nil, scraper_mapping: nil)
      new(html, source_url, scraper_mapping_name, scraper_mapping).extract
    end

    def initialize(html, source_url, scraper_mapping_name, scraper_mapping)
      @uri = URI.parse(source_url)
      @doc = Nokogiri::HTML(html)
      @scraper_mapping = resolve_mapping(scraper_mapping, scraper_mapping_name)
    end

    # Extracts property data from the parsed HTML document.
    #
    # @return [Hash] { success: true, properties: [Hash] }
    def extract
      property_hash = {}

      if scraper_mapping.defaultValues
        scraper_mapping.defaultValues.keys.each do |mapping_key|
          mapping = scraper_mapping.defaultValues[mapping_key]
          property_hash[mapping_key] = mapping['value']
        end
      end

      if scraper_mapping.images
        scraper_mapping.images.each do |image_mapping|
          retrieved_array = retrieve_images_array doc, image_mapping, uri
          property_hash["image_urls"] = retrieved_array
        end
      end

      if scraper_mapping.features
        scraper_mapping.features.each do |feature_mapping|
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

          property_hash[mapping_key] = retrieved_text.strip.send(mapping['evaluator'], evaluator_text)
        end
      end

      { success: true, properties: [property_hash] }
    end

    private

    def resolve_mapping(mapping, name)
      return mapping if mapping.present?
      if name.present?
        found = ScraperMapping.find_by_name(name)
        raise ArgumentError, "Unknown scraper mapping: #{name}" unless found
        return found
      end
      # Auto-detect from URL host
      import_host = ImportHost.find_by(host: @uri.host)
      raise ArgumentError, "No mapping found for host: #{@uri.host}" unless import_host
      ScraperMapping.find_by_name(import_host.scraper_name)
    end

    def retrieve_features_array(doc, mapping, uri)
      retrieved_array = []
      if mapping['cssLocator'].present?
        css_elements = doc.css(mapping['cssLocator'])
        css_elements.each do |element|
          feature_text = get_text_from_css element, mapping
          retrieved_array.push feature_text
        end
      end

      trimmed_and_stripped_array = []
      retrieved_array.each do |string_to_clean|
        cleaned_string = clean_up_string string_to_clean, mapping
        trimmed_and_stripped_array.push cleaned_string
      end
      trimmed_and_stripped_array
    end

    def retrieve_images_array(doc, mapping, uri)
      retrieved_array = []
      if mapping['cssLocator'].present?
        css_elements = doc.css(mapping['cssLocator'])
        css_elements.each do |element|
          img_url = get_text_from_css element, mapping

          # ensure_url_is_absolute
          img_uri = URI.parse(img_url)
          unless img_uri.host
            img_uri.scheme = uri.scheme
            img_uri.host = uri.host
            unless img_uri.path.start_with? "/"
              img_uri.path = "/" + img_uri.path
            end
            if mapping['imagePathPrefix'].present?
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
      end
      trimmed_and_stripped_array
    end

    def retrieve_target_text(doc, mapping, uri)
      retrieved_text = ''
      if mapping['scriptRegEx'].present?
        regex = Regexp.new mapping['scriptRegEx']
        retrieved_text = doc.search("script").text.scan(regex)[0] || ""
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
        retrieved_text = get_text_from_css css_elements, mapping
      end
      retrieved_text = clean_up_string retrieved_text, mapping
    end

    def clean_up_string(string_to_clean, mapping)
      unless mapping['splitTextCharacter'].nil?
        begin
          splitTextCharacter = mapping['splitTextCharacter'] || ' '
          splitTextArrayId = mapping['splitTextArrayId'].to_i
          string_to_clean = string_to_clean.split(splitTextCharacter)[splitTextArrayId]
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
        css_retrieved_text = css_elements.attr(mapping['cssAttr']).to_s
      elsif mapping['xmlAttr'] && css_elements.attr(mapping['xmlAttr'])
        css_retrieved_text = css_elements.attr(mapping['xmlAttr'])
      end

      if mapping['cssCountId'].present?
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
