PropertyWebScraper::Engine.routes.draw do
  root to: 'scraper#welcome'

  get '/single_property_view' => 'single_property_view#show'

  post '/scrapers/submit' => 'scraper#ajax_submit', as: :scrapers_submit
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
