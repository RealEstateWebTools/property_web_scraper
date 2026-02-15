FactoryBot.define do
  factory :property_web_scraper_import_host, class: 'PropertyWebScraper::ImportHost' do
    to_create { |instance| instance.save! }

    sequence(:host) { |n| "www.example#{n}.com" }
    sequence(:scraper_name) { |n| "scraper#{n}" }
    sequence(:slug) { |n| "example#{n}" }

    trait :idealista do
      host { 'www.idealista.com' }
      scraper_name { 'idealista' }
      slug { 'idealista' }
    end

    trait :realtor do
      host { 'www.realtor.com' }
      scraper_name { 'realtor' }
      slug { 'realtor' }
    end

    trait :rightmove do
      host { 'www.rightmove.co.uk' }
      scraper_name { 'rightmove' }
      slug { 'rightmove' }
    end
  end
end
