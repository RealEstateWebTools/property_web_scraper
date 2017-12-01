module PropertyWebScraper
  # link between different scraper_mapping setups and urls
  class ImportHost < ApplicationRecord
    def host_url
      "http://#{host}"
    end
  end
end
