PropertyWebScraper::Engine.routes.draw do
  root to: 'scraper#welcome'
  get '/mls' => 'mls#welcome'
  get '/mls/:mls_slug' => 'mls#welcome'
  post '/mls/submit' => 'mls#ajax_submit'

  get '/stash' => 'stash#index'
  get '/stash/:client_id' => 'stash#show_client'
  get '/stash/:client_id/:prop_id' => 'stash#show_prop'
  # get '/retrieve' => 'scraper#retrieve'
  # get '/scrapers/:id' => 'scraper#show'
  # get '/scrapers/:id/retrieve' => 'scraper#retrieve'


  get '/single_property_view' => 'single_property_view#show'


  # scraper endpoints save to firebase (useful for chrome extension for later retrieval)
  post '/scrapers/submit' => 'scraper#ajax_submit'
  post '/retriever/as_json' => 'scraper#retrieve_as_json'
  get '/retriever/as_json' => 'scraper#retrieve_as_json'
  get '/config/as_json' => 'scraper#config_as_json'

  # api endpoints just return json (useful for use in PropertyWebBuilder to import properties)
  namespace :api do
    namespace :v1 do
      get '/listings' => 'listings#retrieve'
    end
  end
end
