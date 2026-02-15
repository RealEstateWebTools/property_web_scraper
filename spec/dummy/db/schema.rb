# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2026_02_14_234247) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "property_web_scraper_import_hosts", id: :serial, force: :cascade do |t|
    t.integer "flags", default: 0, null: false
    t.string "scraper_name"
    t.string "host"
    t.boolean "is_https"
    t.json "details", default: {}
    t.string "slug"
    t.text "example_urls", default: [], array: true
    t.text "invalid_urls", default: [], array: true
    t.datetime "last_retrieval_at", precision: nil
    t.string "valid_url_regex"
    t.string "pause_between_calls", default: "5.seconds"
    t.string "stale_age", default: "1.day"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.index ["host"], name: "index_property_web_scraper_import_hosts_on_host", unique: true
  end

  create_table "property_web_scraper_listings", id: :serial, force: :cascade do |t|
    t.integer "flags", default: 0, null: false
    t.integer "area_unit", default: 0, null: false
    t.string "reference"
    t.integer "year_construction", default: 0
    t.integer "count_bedrooms", default: 0
    t.float "count_bathrooms", default: 0.0
    t.integer "count_toilets", default: 0
    t.integer "count_garages", default: 0
    t.float "plot_area", default: 0.0
    t.float "constructed_area", default: 0.0
    t.integer "energy_rating"
    t.float "energy_performance"
    t.string "title"
    t.text "description"
    t.string "locale_code"
    t.string "title_es"
    t.text "description_es"
    t.string "title_de"
    t.text "description_de"
    t.string "title_fr"
    t.text "description_fr"
    t.string "title_it"
    t.text "description_it"
    t.boolean "furnished", default: false
    t.boolean "sold", default: false
    t.boolean "reserved", default: false
    t.boolean "for_rent_short_term", default: false
    t.boolean "for_rent_long_term", default: false
    t.boolean "for_sale", default: false
    t.boolean "for_rent", default: false
    t.datetime "deleted_at", precision: nil
    t.datetime "active_from", precision: nil
    t.datetime "available_to_rent_from", precision: nil
    t.datetime "available_to_rent_till", precision: nil
    t.string "price_string"
    t.float "price_float"
    t.integer "price_sale_cents", default: 0, null: false
    t.string "price_sale_currency", default: "USD", null: false
    t.integer "price_rental_cents", default: 0, null: false
    t.string "price_rental_currency", default: "USD", null: false
    t.integer "price_sale_current_cents", default: 0, null: false
    t.string "price_sale_current_currency", default: "USD", null: false
    t.integer "price_sale_original_cents", default: 0, null: false
    t.string "price_sale_original_currency", default: "USD", null: false
    t.integer "price_rental_monthly_current_cents", default: 0, null: false
    t.string "price_rental_monthly_current_currency", default: "USD", null: false
    t.integer "price_rental_monthly_original_cents", default: 0, null: false
    t.string "price_rental_monthly_original_currency", default: "USD", null: false
    t.integer "price_rental_monthly_low_season_cents", default: 0, null: false
    t.string "price_rental_monthly_low_season_currency", default: "USD", null: false
    t.integer "price_rental_monthly_high_season_cents", default: 0, null: false
    t.string "price_rental_monthly_high_season_currency", default: "USD", null: false
    t.integer "price_rental_monthly_standard_season_cents", default: 0, null: false
    t.string "price_rental_monthly_standard_season_currency", default: "USD", null: false
    t.integer "commission_cents", default: 0, null: false
    t.string "commission_currency", default: "USD", null: false
    t.integer "service_charge_yearly_cents", default: 0, null: false
    t.string "service_charge_yearly_currency", default: "USD", null: false
    t.integer "price_rental_monthly_for_search_cents", default: 0, null: false
    t.string "price_rental_monthly_for_search_currency", default: "USD", null: false
    t.string "currency"
    t.string "address_string"
    t.string "street_number"
    t.string "street_name"
    t.string "street_address"
    t.string "postal_code"
    t.string "province"
    t.string "city"
    t.string "region"
    t.string "country"
    t.float "latitude"
    t.float "longitude"
    t.datetime "last_retrieved_at", precision: nil
    t.string "import_host_slug"
    t.integer "re_agent_id"
    t.string "import_url"
    t.json "import_history", default: {}
    t.string "main_image_url"
    t.text "image_urls", default: [], array: true
    t.text "related_urls", default: [], array: true
    t.text "features", default: [], array: true
    t.text "unknown_fields", default: [], array: true
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.index ["flags"], name: "index_property_web_scraper_listings_on_flags"
    t.index ["import_url"], name: "index_property_web_scraper_listings_on_import_url"
    t.index ["price_float"], name: "index_property_web_scraper_listings_on_price_float"
    t.index ["reference"], name: "index_property_web_scraper_listings_on_reference"
  end

end
