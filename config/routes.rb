PropertyWebScraper::Engine.routes.draw do
  root to: 'scraper#welcome'
  get "/retrieve" => "scraper#retrieve"

end
