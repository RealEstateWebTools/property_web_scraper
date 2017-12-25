require 'active_hash'
module PropertyWebScraper
  # https://github.com/zilkey/active_hash
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
      'forsalebyowner', 'realestateindia', 'cerdfw'
  end
end
