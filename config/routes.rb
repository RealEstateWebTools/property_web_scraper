PropertyWebScraper::Engine.routes.draw do
  root to: 'scraper#welcome'
  get '/retrieve' => 'scraper#retrieve'
  get '/scrapers/:id' => 'scraper#show'
  get '/scrapers/:id/retrieve' => 'scraper#retrieve'
  post '/scrapers/submit' => 'scraper#ajax_submit'
end
