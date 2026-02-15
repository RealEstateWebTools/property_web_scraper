require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'SinglePropertyViewController', type: :request do
    include_context 'with seeded import hosts'

    describe 'GET /single_property_view' do
      it 'renders error for missing url' do
        get '/single_property_view'
        expect(response).to have_http_status(200)
        expect(response.body).to include('not valid')
      end

      it 'renders error for an invalid url' do
        get '/single_property_view', params: { url: 'not a valid url' }
        expect(response).to have_http_status(200)
        expect(response.body).to include('not valid')
      end

      it 'renders error for an unsupported host' do
        get '/single_property_view', params: { url: 'https://www.google.com/search' }
        expect(response).to have_http_status(200)
        expect(response.body).to include('unable to retrieve')
      end

      it 'renders property view on success' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          get '/single_property_view', params: { url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
          expect(response).to have_http_status(200)
        end
      end
    end
  end
end
