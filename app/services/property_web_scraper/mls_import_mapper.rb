# Will use MlsImportMappings to associate mls fields with a target schema
module PropertyWebScraper
  class MlsImportMapper
    attr_accessor :mls_import_mappings

    def initialize(mls_name)
      mls_import_mappings = PropertyWebScraper::MlsImportMappings.find_by_name(mls_name)
      raise ArgumentError, 'Not valid mls' if mls_import_mappings.blank?
      self.mls_import_mappings = mls_import_mappings
    end

    def map_property mls_property
      mapped_property = {}

      # direct_mappings is a hash of MLS fieldnames and the equivalent fieldname in pwb
      # eg /pwb/config/import_mappings/mls_olr.json
      direct_mappings = mls_import_mappings.mappings

      # mapped_property_old = mls_property.to_hash.map {|k, v| [direct_mappings[k], v] }.to_h
      # return mapped_property_old.except(nil)

      direct_mappings.each do |mapping|
        origin_field_key = mapping[0]
        target_field = mapping[1]
        field_value = mls_property[origin_field_key].blank? ? target_field["default"] : mls_property[origin_field_key]
        mapped_property[target_field["fieldName"]] = field_value
      end

      # nested_mappings are mappings which are nested under another key
      # eg a city key may be nested below a "building" key
      nested_mappings = mls_import_mappings[:nested_mappings]


      if nested_mappings
        nested_key = nested_mappings["key"]
        nested_mappings["mappings"].each do |mapping|
          origin_field_key = mapping[0]
          target_field = mapping[1]
          if mls_property[nested_key].present? && mls_property[nested_key][origin_field_key].present?
            field_value = mls_property[nested_key][origin_field_key]
          else
            field_value = target_field["default"]
          end
          mapped_property[target_field["fieldName"]] = field_value
        end
      end


      # TODO - figure out way of importing extras
      return mapped_property
    end


  end
end
