require 'active_hash'
module PropertyWebScraper
  # https://github.com/zilkey/active_hash
  class MlsImportSource < ActiveHash::Base
    self.data = [
      {
        id: 1,
        source_type: "rets",
        slug: "mris",
        # unique_name: "mris",
        import_mapper_name: "mls_mris",
        details: {
          login_url: 'http://ptest.mris.com:6103/ptest/login',
          username: 'MRISTEST',
          password: '',
          version: 'RETS/1.7.2',
          agent: 'RETSMD/1.0'
        },
        default_property_class: 'ALL',
        displayName: "MRIS",
        # value: "mris"
      }, {
        id: 2,
        source_type: "rets",
        slug: "interealty",
        # unique_name: "interealty",
        import_mapper_name: "mls_interealty",
        details: {
          login_url: 'http://agdb.rets.interealty.com/Login.asmx/Login',
          username: 'ACTRISBETA1',
          password: '',
          version: 'RETS/1.5',
          agent: 'ACTRISIDX/1.0'
        },
        default_property_class: 'PROPERTY',
        displayName: "InterRealty",
        # value: "interealty"
      }, {
        id: 3,
        source_type: "odata",
        slug: "olr",
        # unique_name: "olr",
        import_mapper_name: "mls_olr",
        details: {
          login_url: 'http://api.olr.com/Service.svc',
          username: '',
          password: ''
        },
        displayName: "OLR"
      }
    ]

    # set_root_path "#{Pwb::Engine.root}/config/client_setups"
    # # set_filename "client_setups"
    # use_multiple_files
    # set_filenames "default", "us"
  end
end
