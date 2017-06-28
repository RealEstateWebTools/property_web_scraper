PropertyWebScraper::Engine.routes.draw do
  root to: 'scraper#welcome'
  get "/retrieve" => "scraper#retrieve"
  get "/scrapers/:scraper_name" => "scraper#show"
  get "/scrapers/:scraper_name/retrieve" => "scraper#retrieve"
  post "/scrapers/submit" => "scraper#submit"

end
