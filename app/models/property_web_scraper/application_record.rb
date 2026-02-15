module PropertyWebScraper
  # Abstract base class for all PropertyWebScraper models.
  #
  # All models in this engine inherit from this class rather than
  # directly from +ActiveRecord::Base+, ensuring proper table name
  # prefixing within the engine namespace.
  class ApplicationRecord < ActiveRecord::Base
    self.abstract_class = true
  end
end
