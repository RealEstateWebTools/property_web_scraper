PropertyWebScraper::Engine.routes.draw do
  root to: 'scraper#welcome'
  get '/stash' => 'stash#index'
  get '/stash/:id' => 'stash#show'
  # get '/retrieve' => 'scraper#retrieve'
  # get '/scrapers/:id' => 'scraper#show'
  # get '/scrapers/:id/retrieve' => 'scraper#retrieve'
  post '/scrapers/submit' => 'scraper#ajax_submit'
  post '/retriever/as_json' => 'scraper#retrieve_as_json'
  get '/retriever/as_json' => 'scraper#retrieve_as_json'
  get '/config/as_json' => 'scraper#config_as_json'
end
