require 'rets'
require 'faraday'
require 'ruby_odata'

module PropertyWebScraper
  class MlsListingsRetriever
    attr_accessor :mls_slug, :password, :import_source

    def initialize(mls_slug, password)
      @mls_slug = mls_slug
      @password = password
    end

    def retrieve query, limit
      @import_source = mls_details
      if import_source.source_type == "odata"
        properties = retrieve_via_odata query, limit
      else
        properties = retrieve_via_rets query, limit
      end

      retrieved_properties = []
      count = 0
      # return render json: properties.as_json

      properties.each do |property|
        if count < 100
          mapped_property = ImportMapper.new(import_source.import_mapper_name).map_property(property)
          retrieved_properties.push mapped_property
        end
        count += 1
      end
      
    end


    private

    def mls_details

      mls_name = mls_slug
      import_source = PropertyWebScraper::MlsImportSource.find_by_slug mls_name

      raise ArgumentError, 'Not supported MLS' if import_source.blank?


      # import_source.details[:username] = params[:username]
      import_source.details[:password] = password
       # password ||''
      # import_source.details[:login_url] = params[:login_url]

      return import_source
    end

    def retrieve_via_odata import_source, query, limit
      # conn = Faraday.new(:url => 'http://dmm-api.olrdev.com/Service.svc') do |faraday|
      #   faraday.basic_auth('', '')
      #   faraday.request  :url_encoded             # form-encode POST params
      #   faraday.response :logger                  # log requests to STDOUT
      #   faraday.adapter  Faraday.default_adapter  # make requests with Net::HTTP
      # end
      # response = conn.get "/Listings()?$filter=RentalListingType%20ge%200L"
      # response.body

      svc = OData::Service.new import_source.details[:login_url],
        { :username => import_source.details[:username],
          :password=> import_source.details[:password]
          }

        svc.Listings.expand('Building')
      listings = svc.execute
      return JSON.parse(listings.to_json)
    end

    def retrieve_via_rets query, limit
      client = Rets::Client.new(import_source.details)
      # $ver = "RETS/1.7.2";
      # $user_agent = "RETS Test/1.0";
      quantity = :all
      # quantity has to be one of :first or :all
      # but would rather use limit than :first
      properties = client.find quantity, {
        search_type: 'Property',
        class: import_source.default_property_class,
        query: query,
        limit: limit
      }
      # photos = client.objects '*', {
      #   resource: 'Property',
      #   object_type: 'Photo',
      #   resource_id: '242502823'
      # }

      return properties
    end

  end
end
