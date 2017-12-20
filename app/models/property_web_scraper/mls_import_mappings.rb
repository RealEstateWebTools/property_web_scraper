require 'active_hash'
# ImportMappings connect fields in an MLS to fields in a target schema
# Currently that target schema is always that used by PropertyWebBuilder
# TODO - allow the definition of different target schemas
module PropertyWebScraper
  class MlsImportMappings < ActiveJSON::Base
    # set_filename "config"
    # not possible to set primary_key like so:
    # self.primary_key = :name

    set_root_path "#{PropertyWebScraper::Engine.root}/config/mls_import_mappings"
    use_multiple_files
    # when adding new files, need to restart server and ensure correct name
    # is used in corresponding json file
    set_filenames "mls_interealty", "mls_mris", "mls_csv_jon", "mls_olr", "api_pwb"
  end
end

