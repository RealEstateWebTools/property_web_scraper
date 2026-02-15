FactoryBot.define do
  factory :property_web_scraper_listing, class: 'PropertyWebScraper::Listing' do
    to_create { |instance| instance.save! }

    sequence(:title) { |n| "Property Listing #{n}" }
    sequence(:import_url) { |n| "https://www.idealista.com/inmueble/#{10000 + n}/" }
    price_float { 250_000.0 }
    price_string { '250,000 EUR' }
    currency { 'EUR' }
    for_sale { true }
    for_rent { false }
    count_bedrooms { 3 }
    count_bathrooms { 2 }
    count_toilets { 1 }
    count_garages { 1 }
    constructed_area { 120 }
    area_unit { 'sqmt' }
    image_urls { [] }
    description { 'A lovely property.' }

    trait :for_rent do
      for_sale { false }
      for_rent { true }
      for_rent_long_term { true }
      price_float { 1_200.0 }
      price_string { '1,200 EUR/month' }
    end

    trait :with_images do
      image_urls { ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'] }
      main_image_url { 'https://example.com/img1.jpg' }
    end

    trait :with_location do
      latitude { 39.4699 }
      longitude { -0.3763 }
      city { 'Valencia' }
      province { 'Valencia' }
      country { 'Spain' }
      street_address { 'Calle de la Paz 10' }
      postal_code { '46003' }
    end
  end
end
