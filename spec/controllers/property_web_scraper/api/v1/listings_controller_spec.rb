require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Api::V1::Listings', type: :request do
    include_context 'with seeded import hosts'

    describe 'API authentication' do
      around(:each) do |example|
        ClimateControl.modify(PROPERTY_SCRAPER_API_KEY: 'test-secret-key') do
          example.run
        end
      end

      it 'returns 401 without api key' do
        get '/api/v1/listings', params: { url: 'https://www.idealista.com/inmueble/123/' }
        expect(response).to have_http_status(:unauthorized)
        json = JSON.parse(response.body)
        expect(json['error_message']).to eq('Unauthorized')
      end

      it 'returns 401 with wrong api key' do
        get '/api/v1/listings',
            params: { url: 'https://www.idealista.com/inmueble/123/' },
            headers: { 'X-Api-Key' => 'wrong-key' }
        expect(response).to have_http_status(:unauthorized)
      end

      it 'succeeds with correct api key via header' do
        get '/api/v1/listings',
            params: { url: 'https://www.idealista.com/inmueble/123/' },
            headers: { 'X-Api-Key' => 'test-secret-key' }
        # Should not be 401 (may be other error due to missing VCR cassette, but not auth error)
        expect(response).not_to have_http_status(:unauthorized)
      end

      it 'succeeds with correct api key via query param' do
        get '/api/v1/listings',
            params: { url: 'https://www.idealista.com/inmueble/123/', api_key: 'test-secret-key' }
        expect(response).not_to have_http_status(:unauthorized)
      end
    end

    describe 'authentication skipped when env var unset' do
      it 'allows access without api key' do
        get '/api/v1/listings'
        # Should get a validation error, not 401
        json = JSON.parse(response.body)
        expect(json['error_message']).to include('provide a url')
      end
    end

    describe 'GET /api/v1/listings' do
      it 'returns error when url parameter is missing' do
        get '/api/v1/listings'
        json = JSON.parse(response.body)
        expect(json['success']).to eq(false)
        expect(json['error_message']).to include('provide a url')
      end

      it 'returns error for an invalid url' do
        get '/api/v1/listings', params: { url: 'not a url' }
        json = JSON.parse(response.body)
        expect(json['success']).to eq(false)
        expect(json['error_message']).to include('valid url')
      end

      it 'returns error for an unsupported host' do
        get '/api/v1/listings', params: { url: 'https://www.google.com/search' }
        json = JSON.parse(response.body)
        expect(json['success']).to eq(false)
        expect(json['error_message']).to include('not supported')
      end

      it 'returns listings on success (idealista)' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          get '/api/v1/listings', params: { url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
          json = JSON.parse(response.body)
          expect(json['success']).to eq(true)
          expect(json['listings']).to be_an(Array)
          expect(json['retry_duration']).to eq(0)
          expect(json['urls_remaining']).to eq(0)
        end
      end

      it 'returns listings on success (rightmove)' do
        VCR.use_cassette('scrapers/rightmove') do
          get '/api/v1/listings', params: { url: 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html' }
          json = JSON.parse(response.body)
          expect(json['success']).to eq(true)
          expect(json['listings']).to be_an(Array)
          expect(json['listings'].length).to eq(1)
        end
      end

      it 'returns PwbListing-formatted data with computed fields' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          get '/api/v1/listings', params: { url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
          json = JSON.parse(response.body)
          listing = json['listings'].first
          expect(listing).to have_key('property_photos')
          expect(listing).to have_key('price_sale_current')
          expect(listing).to have_key('price_rental_monthly_current')
        end
      end
    end
  end
end
