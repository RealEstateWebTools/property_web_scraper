# Load the engine's import hosts seed data
load File.join(PropertyWebScraper::Engine.root, 'db', 'seeds', 'import_hosts.rb')

# Create sample listings for manual browser testing
# last_retrieved_at must be set so the scraper treats these as fresh
# and does not attempt to fetch from the live URL
now = DateTime.now

listings_data = [
  {
    title: 'Sunny Beachfront Villa in Valencia',
    description: 'Stunning 4-bedroom villa with panoramic sea views, private pool, and landscaped gardens. '\
                 'Recently renovated with modern finishes throughout. Open-plan living area with floor-to-ceiling '\
                 'windows overlooking the Mediterranean. Walking distance to shops and restaurants.',
    reference: 'VAL-2024-001',
    import_url: 'https://www.idealista.com/inmueble/99900001/',
    import_host_slug: 'idealista',
    last_retrieved_at: now,
    for_sale: true,
    for_rent: false,
    price_float: 485_000.0,
    price_string: '485,000 EUR',
    currency: 'EUR',
    count_bedrooms: 4,
    count_bathrooms: 3,
    count_toilets: 1,
    count_garages: 2,
    constructed_area: 220,
    plot_area: 450,
    area_unit: :sqmt,
    year_construction: 2005,
    latitude: 39.4699,
    longitude: -0.3763,
    city: 'Valencia',
    province: 'Valencia',
    country: 'Spain',
    street_address: 'Paseo Maritimo 42',
    postal_code: '46011',
    main_image_url: 'https://placehold.co/800x400?text=Valencia+Villa',
    image_urls: [
      'https://placehold.co/800x400?text=Valencia+Villa',
      'https://placehold.co/800x400?text=Living+Room',
      'https://placehold.co/800x400?text=Kitchen',
      'https://placehold.co/800x400?text=Pool+Area'
    ],
    features: ['Swimming Pool', 'Garden', 'Terrace', 'Air Conditioning', 'Central Heating', 'Garage']
  },
  {
    title: 'Modern City Apartment in London',
    description: 'Stylish 2-bedroom apartment in the heart of Shoreditch. Features an open-plan kitchen '\
                 'and living area, private balcony, and secure underground parking. Excellent transport links '\
                 'with Liverpool Street station a short walk away.',
    reference: 'LON-2024-015',
    import_url: 'https://www.rightmove.co.uk/property-for-sale/property-88800001.html',
    import_host_slug: 'rightmove',
    last_retrieved_at: now,
    for_sale: true,
    for_rent: false,
    price_float: 650_000.0,
    price_string: '650,000 GBP',
    currency: 'GBP',
    count_bedrooms: 2,
    count_bathrooms: 2,
    count_toilets: 1,
    count_garages: 1,
    constructed_area: 85,
    area_unit: :sqmt,
    year_construction: 2018,
    latitude: 51.5235,
    longitude: -0.0754,
    city: 'London',
    province: 'Greater London',
    country: 'United Kingdom',
    street_address: '15 Rivington Street',
    postal_code: 'EC2A 3DU',
    main_image_url: 'https://placehold.co/800x400?text=London+Apartment',
    image_urls: [
      'https://placehold.co/800x400?text=London+Apartment',
      'https://placehold.co/800x400?text=Open+Plan+Living',
      'https://placehold.co/800x400?text=Balcony+View'
    ],
    features: ['Balcony', 'Underground Parking', 'Concierge', 'Lift']
  },
  {
    title: 'Spacious Family Home in Dallas',
    description: 'Beautiful 5-bedroom family home in a quiet suburban neighborhood. Large backyard with '\
                 'mature trees, updated kitchen with granite countertops, hardwood floors throughout. '\
                 'Highly rated school district.',
    reference: 'DAL-2024-042',
    import_url: 'http://www.realtor.com/realestateandhomes-detail/123-Oak-Lane_Dallas_TX_75201_M99900-42',
    import_host_slug: 'realtor',
    last_retrieved_at: now,
    for_sale: true,
    for_rent: false,
    price_float: 375_000.0,
    price_string: '$375,000',
    currency: 'USD',
    count_bedrooms: 5,
    count_bathrooms: 3,
    count_toilets: 1,
    count_garages: 2,
    constructed_area: 2800,
    plot_area: 5500,
    area_unit: :sqft,
    year_construction: 1998,
    latitude: 32.7767,
    longitude: -96.7970,
    city: 'Dallas',
    province: 'Texas',
    country: 'United States',
    street_address: '123 Oak Lane',
    postal_code: '75201',
    main_image_url: 'https://placehold.co/800x400?text=Dallas+Family+Home',
    image_urls: [
      'https://placehold.co/800x400?text=Dallas+Family+Home',
      'https://placehold.co/800x400?text=Kitchen',
      'https://placehold.co/800x400?text=Backyard',
      'https://placehold.co/800x400?text=Master+Bedroom',
      'https://placehold.co/800x400?text=Living+Room'
    ],
    features: ['Hardwood Floors', 'Granite Countertops', 'Fireplace', 'Central AC', 'Backyard']
  },
  {
    title: 'Rental Apartment in Barcelona',
    description: 'Charming 1-bedroom apartment available for long-term rent in the Eixample district. '\
                 'High ceilings, original mosaic floors, and a small balcony facing a tree-lined street. '\
                 'Fully furnished and ready to move in.',
    reference: 'BCN-2024-R08',
    import_url: 'https://www.idealista.com/inmueble/99900004/',
    import_host_slug: 'idealista',
    last_retrieved_at: now,
    for_sale: false,
    for_rent: true,
    for_rent_long_term: true,
    price_float: 1_350.0,
    price_string: '1,350 EUR/month',
    currency: 'EUR',
    count_bedrooms: 1,
    count_bathrooms: 1,
    count_toilets: 1,
    count_garages: 0,
    constructed_area: 55,
    area_unit: :sqmt,
    year_construction: 1920,
    furnished: true,
    latitude: 41.3874,
    longitude: 2.1686,
    city: 'Barcelona',
    province: 'Catalonia',
    country: 'Spain',
    street_address: 'Carrer de Mallorca 250',
    postal_code: '08008',
    main_image_url: 'https://placehold.co/800x400?text=Barcelona+Rental',
    image_urls: [
      'https://placehold.co/800x400?text=Barcelona+Rental',
      'https://placehold.co/800x400?text=Bedroom',
      'https://placehold.co/800x400?text=Mosaic+Floors'
    ],
    features: ['Furnished', 'Balcony', 'High Ceilings', 'Lift']
  },
  {
    title: 'Countryside Cottage near Oxford',
    description: 'Idyllic 3-bedroom stone cottage in the Cotswolds countryside. Period features '\
                 'including exposed beams, inglenook fireplace, and a cottage garden with views '\
                 'over rolling hills. Available for short-term holiday lets.',
    reference: 'OXF-2024-R12',
    import_url: 'https://www.zoopla.co.uk/to-rent/details/99900005/',
    import_host_slug: 'zoopla',
    last_retrieved_at: now,
    for_sale: false,
    for_rent: true,
    for_rent_short_term: true,
    price_float: 180.0,
    price_string: '180 GBP/night',
    currency: 'GBP',
    count_bedrooms: 3,
    count_bathrooms: 2,
    count_toilets: 1,
    count_garages: 0,
    constructed_area: 130,
    plot_area: 800,
    area_unit: :sqmt,
    year_construction: 1850,
    furnished: true,
    latitude: 51.7520,
    longitude: -1.2577,
    city: 'Witney',
    province: 'Oxfordshire',
    country: 'United Kingdom',
    street_address: 'Mill Lane 3',
    postal_code: 'OX28 6AB',
    main_image_url: 'https://placehold.co/800x400?text=Cotswolds+Cottage',
    image_urls: [
      'https://placehold.co/800x400?text=Cotswolds+Cottage',
      'https://placehold.co/800x400?text=Fireplace',
      'https://placehold.co/800x400?text=Garden+View'
    ],
    features: ['Fireplace', 'Garden', 'Period Features', 'Exposed Beams', 'Rural Setting']
  }
]

listings_data.each do |data|
  unless PropertyWebScraper::Listing.exists?(import_url: data[:import_url])
    PropertyWebScraper::Listing.create!(data)
    puts "  Created listing: #{data[:title]}"
  end
end

puts "Seeded import hosts"
puts "Seeded #{listings_data.size} listings"
