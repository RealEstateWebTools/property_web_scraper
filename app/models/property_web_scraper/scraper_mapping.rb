require 'active_hash'
module PropertyWebScraper
  # Loads scraper configuration from JSON files using ActiveHash.
  #
  # Each JSON file in +config/scraper_mappings/+ defines CSS selectors,
  # XPath expressions, regex patterns, and field mappings used by
  # {Scraper} to extract property data from a specific website.
  #
  # @example Finding a mapping
  #   mapping = ScraperMapping.find_by_name('idealista')
  #   mapping.textFields  #=> { "title" => { "cssLocator" => "..." }, ... }
  class ScraperMapping < ActiveJSON::Base
    # set_filename "config"
    # not possible to set primary_key like so:
    # self.primary_key = :name

    set_root_path "#{PropertyWebScraper::Engine.root}/config/scraper_mappings"
    use_multiple_files
    # when adding new files, need to restart server and ensure correct name
    # is used in corresponding json file
    set_filenames 'pwb', 'mlslistings', 'realtor', 'fotocasa',
      'idealista', 'zoopla', 'rightmove', 'wyomingmls', 'carusoimmobiliare',
      'forsalebyowner', 'realestateindia', 'cerdfw', 'pisos', 'inmo1'
  end
end
