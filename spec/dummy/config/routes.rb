Rails.application.routes.draw do
  mount PropertyWebScraper::Engine => "/"
end
