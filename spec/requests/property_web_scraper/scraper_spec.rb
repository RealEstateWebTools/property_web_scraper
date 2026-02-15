require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'ScraperController', type: :request do
    include_context 'with seeded import hosts'

    describe 'GET /' do
      it 'returns 200' do
        get '/'
        expect(response).to have_http_status(200)
      end
    end

    describe 'GET /config/as_json' do
      it 'returns config when realtor host exists' do
        get '/config/as_json'
        json = JSON.parse(response.body)
        expect(json['success']).to eq(true)
        expect(json['key']).to eq('www.realtor.com')
        expect(json['config']).to be_an(Array)
      end

      it 'returns failure when realtor host is missing' do
        PropertyWebScraper::ImportHost.where(host: 'www.realtor.com').delete_all
        get '/config/as_json'
        json = JSON.parse(response.body)
        expect(json['success']).to eq(false)
        expect(json['key']).to eq('import_host')
      end
    end

    describe 'POST /retriever/as_json' do
      it 'returns error when url parameter is missing' do
        post '/retriever/as_json'
        json = JSON.parse(response.body)
        expect(json['success']).to eq(false)
        expect(json['error_message']).to include('provide a url')
      end

      it 'returns error for an invalid url' do
        post '/retriever/as_json', params: { url: 'not a url' }
        json = JSON.parse(response.body)
        expect(json['success']).to eq(false)
        expect(json['error_message']).to include('valid url')
      end

      it 'returns error for an unsupported host' do
        post '/retriever/as_json', params: { url: 'https://www.google.com/search' }
        json = JSON.parse(response.body)
        expect(json['success']).to eq(false)
        expect(json['error_message']).to include('not supported')
      end

      it 'returns listing on success' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          post '/retriever/as_json', params: { url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
          json = JSON.parse(response.body)
          expect(json['success']).to eq(true)
          expect(json['listing']).to be_present
        end
      end
    end

    describe 'POST /scrapers/submit' do
      it 'processes a valid submission' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          post '/scrapers/submit',
               params: { import_url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' },
               headers: { 'Accept' => 'text/javascript', 'Content-Type' => 'application/x-www-form-urlencoded' }
          expect(response).to have_http_status(200)
        end
      end
    end
  end
end
