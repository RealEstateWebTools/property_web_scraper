module PropertyWebScraper
  class ImportHost < ApplicationRecord
    def host_url
      "http://#{self.host}"
    end
  end
end
