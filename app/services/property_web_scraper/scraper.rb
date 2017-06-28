require 'nokogiri'
require 'open-uri'
require 'faraday'


module PropertyWebScraper
  class Scraper
    attr_accessor :scraper_mapping

    def initialize(scraper_mapping)
      self.scraper_mapping = PropertyWebScraper::ScraperMapping.find_by_name(scraper_mapping)
      # self.scraper_mapping = scraper_mapping
      raise ArgumentError.new("Not valid scraper") if self.scraper_mapping.blank?
    end

    def retrieve_from_api
      conn = Faraday.new(:url => target_url) do |faraday|
        # faraday.basic_auth('', '')
        faraday.request  :url_encoded             # form-encode POST params
        faraday.response :logger                  # log requests to STDOUT
        faraday.adapter  Faraday.default_adapter  # make requests with Net::HTTP
      end
      response = conn.get "/api_public/v1/props.json"

      response_as_json = JSON.parse response.body
      retrieved_properties = []
      count = 0
      response_as_json["data"].each do |property|
        if count < 100
          mapped_property = ImportMapper.new("api_pwb").map_property(property["attributes"])
          retrieved_properties.push mapped_property
        end
        count += 1
      end
      return retrieved_properties
    end

    def retrieve_from_webpage target_url
      # just a proof of concept at this stage
      properties = []
      property_hash = {}

      # Fetch and parse HTML document
      doc = Nokogiri::HTML(open(target_url))

      # if target_url.include? "public.olr.com"
      #   # byebug
      # end

      scraper_mapping.textFields.keys.each do |mapping_key|
        mapping = scraper_mapping.textFields[mapping_key]
        target_text = retrieve_target_text doc, mapping
        property_hash[mapping_key] = target_text.strip
      end

      scraper_mapping.booleanFields.keys.each do |mapping_key|
        mapping = scraper_mapping.booleanFields[mapping_key]
        target_text = retrieve_target_text doc, mapping
        # target_element = doc.css(mapping["cssLocator"])[mapping["cssCountId"].to_i] || ""
        property_hash[mapping_key] = target_text.strip.send(mapping["evaluator"], mapping["evaluatorParam"])
      end

      # images = []
      # byebug
      # doc.css(".imgvspace").each do |image_tag|
      #   image_url = image_tag["src"]
      #   images.push image_url
      # end
      # property_hash["images"] = images

      # property_hash["price_sale_current"] = doc.css('.listing_detail_field2')[2].content

      # property_hash["description_en"] = doc.css('.detail_indent').first.content
      # property_hash["extras"] = doc.css('.detail_indent').last.content


      properties.push property_hash
      return properties
    end

    private

    def retrieve_target_text doc, mapping
      target_elements = mapping["cssLocator"].present? ? doc.css(mapping["cssLocator"]) : []
      target_text = ""
      if target_elements.present?
        target_text = target_elements.text
        if mapping["cssCountId"].present?
          # in this case we have multiple elements matched
          # and the cssCountId refers to where in the list of matched elements 
          # the correct item is
          begin
            css_count_id = mapping["cssCountId"].to_i
            target_text = target_elements[css_count_id].text || ""
          rescue Exception => e
          end
        end
        if !mapping["splitTextCharacter"].nil?
          # - cannot use .present? above as splitTextCharacter is sometimes " " 
          # mapping["splitTextCharacter"].present?
          # 
          # in this case the element's text need to be split by the splitTextCharacter
          # splitTextArrayId refers to where in the resulting array 
          # the correct item is
          begin
            splitTextCharacter = mapping["splitTextCharacter"] || " "
            splitTextArrayId = mapping["splitTextArrayId"].to_i
            target_text = target_elements.text.split(splitTextCharacter)[splitTextArrayId]
          rescue Exception => e
          end
        end
      end
      return target_text
    end


  end
end
