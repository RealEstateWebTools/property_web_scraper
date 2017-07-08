require 'nokogiri'
require 'open-uri'
require 'faraday'

module PropertyWebScraper
  class Scraper
    attr_accessor :scraper_mapping

    def initialize(scraper_mapping)
      self.scraper_mapping = PropertyWebScraper::ScraperMapping.find_by_name(scraper_mapping)
      raise ArgumentError, 'Not valid scraper' if self.scraper_mapping.blank?
    end

    # def retrieve_from_api
    #   conn = Faraday.new(:url => import_url) do |faraday|
    #     # faraday.basic_auth('', '')
    #     faraday.request  :url_encoded             # form-encode POST params
    #     faraday.response :logger                  # log requests to STDOUT
    #     faraday.adapter  Faraday.default_adapter  # make requests with Net::HTTP
    #   end
    #   response = conn.get "/api_public/v1/props.json"

    #   response_as_json = JSON.parse response.body
    #   retrieved_properties = []
    #   count = 0
    #   response_as_json["data"].each do |property|
    #     if count < 100
    #       mapped_property = ImportMapper.new("api_pwb").map_property(property["attributes"])
    #       retrieved_properties.push mapped_property
    #     end
    #     count += 1
    #   end
    #   return retrieved_properties
    # end

    def retrieve_and_save(import_url, import_host_id)
      retrieved_properties = retrieve_from_webpage import_url
      listing = PropertyWebScraper::Listing.where(import_url: import_url).first_or_create
      listing.import_host_id = import_host_id
      listing.last_retrieved_at = DateTime.now

      Listing.update_from_hash listing, retrieved_properties[0]

      listing
    end

    def retrieve_from_webpage(import_url)
      # just a proof of concept at this stage
      properties = []
      property_hash = {}

      # Fetch and parse HTML document
      doc = Nokogiri::HTML(open(import_url))

      if scraper_mapping.defaultValues
        scraper_mapping.defaultValues.keys.each do |mapping_key|
          mapping = scraper_mapping.defaultValues[mapping_key]
          property_hash[mapping_key] = mapping["value"]
        end
      end

      if scraper_mapping.intFields
        scraper_mapping.intFields.keys.each do |mapping_key|
          mapping = scraper_mapping.intFields[mapping_key]
          target_text = retrieve_target_text doc, mapping
          property_hash[mapping_key] = target_text.strip.to_i
        end
      end

      if scraper_mapping.floatFields
        scraper_mapping.floatFields.keys.each do |mapping_key|
          mapping = scraper_mapping.floatFields[mapping_key]
          target_text = retrieve_target_text doc, mapping
          # if mapping['comaToDot']
          #   target_text = target_text.strip.tr(',', '.')
          # end
          if mapping['stripPunct']
            target_text = target_text.tr('.', '').tr(',', '')
          end
          if mapping['stripFirstChar']
            target_text = target_text.strip.last(-1) || ""
          end
          property_hash[mapping_key] = target_text.strip.to_f
        end
      end

      scraper_mapping.textFields.keys.each do |mapping_key|
        mapping = scraper_mapping.textFields[mapping_key]
        target_text = retrieve_target_text doc, mapping
        property_hash[mapping_key] = target_text.strip
      end

      scraper_mapping.booleanFields.keys.each do |mapping_key|
        mapping = scraper_mapping.booleanFields[mapping_key]
        target_text = retrieve_target_text doc, mapping
        # target_element = doc.css(mapping["cssLocator"])[mapping["cssCountId"].to_i] || ""
        property_hash[mapping_key] = target_text.strip.send(mapping['evaluator'], mapping['evaluatorParam'])
      end
      properties.push property_hash
      properties
    end

    private

    def retrieve_target_text(doc, mapping)
      target_text = ''
      if mapping['cssLocator'].present?
        css_elements = doc.css(mapping['cssLocator'])
        target_text = get_text_from_css css_elements, mapping
      end
      if mapping['xpath'].present?
        css_elements = doc.css(mapping['xpath'])
        # able to retrieve xpath just like with css
        # but in future this might change
        target_text = get_text_from_css css_elements, mapping
      end
      return target_text
    end

    def get_text_from_css css_elements, mapping
      target_text = css_elements.text
      if mapping['cssCountId'].present?
        # in this case we have multiple elements matched
        # and the cssCountId refers to where in the list of matched elements
        # the correct item is
        begin
          css_count_id = mapping['cssCountId'].to_i
          target_text = css_elements[css_count_id].text || ''
        rescue Exception => e
        end
      end
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
          target_text = css_elements.text.split(splitTextCharacter)[splitTextArrayId]
        rescue Exception => e
        end
      end
      return target_text
    end

  end
end
