module PropertyWebScraper
  # Abstract base class for all PropertyWebScraper models.
  #
  # All models in this engine inherit from this class, which provides
  # a Firestore-backed ActiveRecord-compatible API via FirestoreModel.
  class ApplicationRecord
    include FirestoreModel
  end
end
