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
        # Re-seed the deleted record to avoid polluting other tests
        PropertyWebScraper::ImportHost.create!(slug: 'realtor', scraper_name: 'realtor', host: 'www.realtor.com')
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

      it 'returns listing on success (idealista)' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          post '/retriever/as_json', params: { url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
          json = JSON.parse(response.body)
          expect(json['success']).to eq(true)
          expect(json['listing']).to be_present
        end
      end

      it 'returns listing on success (rightmove)' do
        VCR.use_cassette('scrapers/rightmove') do
          post '/retriever/as_json', params: { url: 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html' }
          json = JSON.parse(response.body)
          expect(json['success']).to eq(true)
          expect(json['listing']).to be_present
        end
      end

      it 'returns listing on success (realtor)' do
        VCR.use_cassette('scrapers/realtor') do
          post '/retriever/as_json', params: { url: 'http://www.realtor.com/realestateandhomes-detail/5804-Cedar-Glen-Ln_Bakersfield_CA_93313_M12147-18296' }
          json = JSON.parse(response.body)
          expect(json['success']).to eq(true)
          expect(json['listing']).to be_present
        end
      end

      it 'returns listing on success (zoopla)' do
        VCR.use_cassette('scrapers/zoopla') do
          post '/retriever/as_json', params: { url: 'https://www.zoopla.co.uk/for-sale/details/43719239' }
          json = JSON.parse(response.body)
          expect(json['success']).to eq(true)
          expect(json['listing']).to be_present
        end
      end

      it 'preserves client_id when provided' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          post '/retriever/as_json', params: { url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/', client_id: 'my_custom_client_id' }
          json = JSON.parse(response.body)
          expect(json['client_id']).to eq('my_custom_client_id')
        end
      end
    end

    describe 'POST /retriever/as_json with html parameter' do
      let(:html) do
        path = File.join(PropertyWebScraper::Engine.root, 'spec', 'fixtures', 'vcr', 'scrapers', 'idealista_2018_01.yml')
        cassette = YAML.safe_load(File.read(path), permitted_classes: [Symbol])
        cassette['http_interactions'].first['response']['body']['string']
      end

      it 'extracts from provided HTML without HTTP fetch' do
        post '/retriever/as_json', params: {
          url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
          html: html
        }
        json = JSON.parse(response.body)
        expect(json['success']).to eq(true)
        expect(json['listing']).to be_present
      end

      it 'extracts from uploaded HTML file' do
        file = Rack::Test::UploadedFile.new(
          StringIO.new(html), 'text/html', false, original_filename: 'page.html'
        )
        post '/retriever/as_json', params: {
          url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
          html_file: file
        }
        json = JSON.parse(response.body)
        expect(json['success']).to eq(true)
        expect(json['listing']).to be_present
      end
    end

    describe 'API authentication' do
      around(:each) do |example|
        ClimateControl.modify(PROPERTY_SCRAPER_API_KEY: 'test-secret-key') do
          example.run
        end
      end

      it 'returns 401 without api key on retrieve_as_json' do
        post '/retriever/as_json', params: { url: 'https://www.idealista.com/inmueble/123/' }
        expect(response).to have_http_status(:unauthorized)
        json = JSON.parse(response.body)
        expect(json['error_message']).to eq('Unauthorized')
      end

      it 'returns 401 with wrong api key on retrieve_as_json' do
        post '/retriever/as_json',
             params: { url: 'https://www.idealista.com/inmueble/123/' },
             headers: { 'X-Api-Key' => 'wrong-key' }
        expect(response).to have_http_status(:unauthorized)
      end

      it 'returns 401 without api key on config_as_json' do
        get '/config/as_json'
        expect(response).to have_http_status(:unauthorized)
      end

      it 'succeeds with correct api key via header' do
        get '/config/as_json', headers: { 'X-Api-Key' => 'test-secret-key' }
        expect(response).not_to have_http_status(:unauthorized)
      end

      it 'succeeds with correct api key via query param' do
        get '/config/as_json', params: { api_key: 'test-secret-key' }
        expect(response).not_to have_http_status(:unauthorized)
      end

      it 'does not require auth on welcome' do
        get '/'
        expect(response).to have_http_status(200)
      end
    end

    describe 'authentication skipped when env var unset' do
      it 'allows access without api key' do
        get '/config/as_json'
        expect(response).not_to have_http_status(:unauthorized)
      end
    end

    describe 'POST /scrapers/submit' do
      it 'processes a valid submission' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          post '/scrapers/submit',
               params: { import_url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' },
               headers: { 'Accept' => 'text/html', 'Content-Type' => 'application/x-www-form-urlencoded' }
          expect(response).to have_http_status(200)
          expect(response.body).to include('turbo-frame')
        end
      end
    end
  end
end
