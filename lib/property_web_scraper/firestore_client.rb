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

        if ENV['FIRESTORE_EMULATOR_HOST']
          Google::Cloud::Firestore.new(project_id: project_id)
        elsif ENV['FIRESTORE_CREDENTIALS']
          Google::Cloud::Firestore.new(
            project_id: project_id,
            credentials: ENV['FIRESTORE_CREDENTIALS']
          )
        else
          Google::Cloud::Firestore.new(project_id: project_id)
        end
      end
    end
  end
end
