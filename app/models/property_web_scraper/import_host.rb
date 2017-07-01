module PropertyWebScraper
  class ImportHost < ApplicationRecord
    def host_url
      "http://#{host}"
    end
  end
end
