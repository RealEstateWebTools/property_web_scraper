Rails.application.routes.draw do
  mount PropertyWebScraper::Engine => "/property_web_scraper"
end
