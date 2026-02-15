require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'Api::V1::Listings', type: :request do
    include_context 'with seeded import hosts'

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
