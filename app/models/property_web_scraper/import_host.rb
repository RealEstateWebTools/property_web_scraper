module PropertyWebScraper
  # link between different scraper_mapping setups and urls
  class ImportHost < ApplicationRecord
    def host_url
      "http://#{host}"
    end

    # TODO - use valid_url_regex to decide if url is valid for current import host
    #   - also use pause_between_calls + last_retrieval_at to decide 
    # when to hit server again 

    def stale_age_duration
      duration_string = "1.day"
      # self.stale_age || "1.day"
      # https://stackoverflow.com/questions/34506174/convert-string-to-activesupportduration
      duration_parts = duration_string.split('.')
      duration_parts.first.to_i.send(duration_parts.last)
    end
  end
end
