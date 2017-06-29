# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20170628201113) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "property_web_scraper_import_hosts", force: :cascade do |t|
    t.integer  "flags",        default: 0,  null: false
    t.string   "scraper_name"
    t.string   "host"
    t.boolean  "is_https"
    t.json     "details",      default: {}
    t.string   "slug"
    t.datetime "created_at",                null: false
    t.datetime "updated_at",                null: false
    t.index ["host"], name: "index_property_web_scraper_import_hosts_on_host", unique: true, using: :btree
  end

  create_table "property_web_scraper_listings", force: :cascade do |t|
    t.integer  "flags",                  default: 0,     null: false
    t.string   "reference"
    t.integer  "year_construction",      default: 0,     null: false
    t.integer  "count_bedrooms",         default: 0,     null: false
    t.float    "count_bathrooms",        default: 0.0,   null: false
    t.integer  "count_toilets",          default: 0,     null: false
    t.integer  "count_garages",          default: 0,     null: false
    t.float    "plot_area",              default: 0.0,   null: false
    t.float    "constructed_area",       default: 0.0,   null: false
    t.integer  "energy_rating"
    t.float    "energy_performance"
    t.string   "title"
    t.text     "description"
    t.string   "locale_code"
    t.boolean  "furnished",              default: false
    t.boolean  "sold",                   default: false
    t.boolean  "reserved",               default: false
    t.boolean  "for_rent_short_term",    default: false
    t.boolean  "for_rent_long_term",     default: false
    t.boolean  "for_sale",               default: false
    t.datetime "available_to_rent_from"
    t.datetime "available_to_rent_till"
    t.string   "price"
    t.string   "currency"
    t.string   "street_number"
    t.string   "street_name"
    t.string   "street_address"
    t.string   "postal_code"
    t.string   "province"
    t.string   "city"
    t.string   "region"
    t.string   "country"
    t.float    "latitude"
    t.float    "longitude"
    t.datetime "last_retrieved_at"
    t.json     "import_history",         default: {}
    t.datetime "created_at",                             null: false
    t.datetime "updated_at",                             null: false
  end

end
