require 'google/cloud/firestore'

module PropertyWebScraper
  # Singleton wrapper around Google::Cloud::Firestore.
  #
  # Reads configuration from environment variables:
  # - +FIRESTORE_PROJECT_ID+ — GCP project ID
  # - +FIRESTORE_CREDENTIALS+ — path to service account JSON (production)
  # - +FIRESTORE_EMULATOR_HOST+ — connects to local emulator when set (dev/test)
  module FirestoreClient
    class << self
      def client
        @client ||= build_client
      end

      def reset!
        @client = nil
      end

      private

      def build_client
        project_id = ENV.fetch('FIRESTORE_PROJECT_ID', 'property-web-scraper-dev')

        logger = defined?(Rails) ? Rails.logger : Logger.new($stdout)
        logger.info "FirestoreClient: project_id=#{project_id}"
        logger.info "FirestoreClient: FIRESTORE_EMULATOR_HOST=#{ENV['FIRESTORE_EMULATOR_HOST'].inspect}"
        logger.info "FirestoreClient: FIRESTORE_CREDENTIALS=#{ENV['FIRESTORE_CREDENTIALS'].inspect}"

        if ENV['FIRESTORE_EMULATOR_HOST']
          logger.info "FirestoreClient: connecting via emulator"
          Google::Cloud::Firestore.new(project_id: project_id)
        elsif ENV['FIRESTORE_CREDENTIALS']
          creds_path = ENV['FIRESTORE_CREDENTIALS']
          logger.info "FirestoreClient: credentials file exists=#{File.exist?(creds_path)}, absolute_path=#{File.expand_path(creds_path)}"
          Google::Cloud::Firestore.new(
            project_id: project_id,
            credentials: creds_path
          )
        else
          logger.warn "FirestoreClient: no emulator or credentials configured, falling back to ADC"
          Google::Cloud::Firestore.new(project_id: project_id)
        end
      end
    end
  end
end
