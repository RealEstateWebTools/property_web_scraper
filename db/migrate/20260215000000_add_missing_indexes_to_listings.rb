class AddMissingIndexesToListings < ActiveRecord::Migration[7.2]
  def change
    add_index :property_web_scraper_listings, :city
    add_index :property_web_scraper_listings, :country
    add_index :property_web_scraper_listings, :import_host_slug
    add_index :property_web_scraper_listings, [:latitude, :longitude], name: "index_pws_listings_on_lat_lng"
    add_index :property_web_scraper_listings, :created_at
  end
end
