require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'SinglePropertyViewController', type: :request do
    include_context 'with seeded import hosts'

    describe 'GET /single_property_view' do
      it 'renders error for missing url' do
        get '/single_property_view'
        expect(response).to have_http_status(200)
        expect(response.body).to include('provide a url')
      end

      it 'renders error for an invalid url' do
        get '/single_property_view', params: { url: 'not a valid url' }
        expect(response).to have_http_status(200)
        expect(response.body).to include('valid url')
      end

      it 'renders error for an unsupported host' do
        get '/single_property_view', params: { url: 'https://www.google.com/search' }
        expect(response).to have_http_status(200)
        expect(response.body).to include('not supported')
      end

      it 'renders property view on success (idealista)' do
        VCR.use_cassette('scrapers/idealista_2018_01') do
          get '/single_property_view', params: { url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/' }
          expect(response).to have_http_status(200)
        end
      end

      it 'renders property view on success (rightmove)' do
        VCR.use_cassette('scrapers/rightmove') do
          get '/single_property_view', params: { url: 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html' }
          expect(response).to have_http_status(200)
        end
      end

      it 'renders property view on success (realtor)' do
        VCR.use_cassette('scrapers/realtor') do
          get '/single_property_view', params: { url: 'http://www.realtor.com/realestateandhomes-detail/5804-Cedar-Glen-Ln_Bakersfield_CA_93313_M12147-18296' }
          expect(response).to have_http_status(200)
        end
      end

      context 'with html parameter' do
        let(:html) do
          path = File.join(PropertyWebScraper::Engine.root, 'spec', 'fixtures', 'vcr', 'scrapers', 'idealista_2018_01.yml')
          cassette = YAML.safe_load(File.read(path), permitted_classes: [Symbol])
          cassette['http_interactions'].first['response']['body']['string']
        end

        it 'renders property view from provided HTML without HTTP fetch' do
          get '/single_property_view', params: {
            url: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
            html: html
          }
          expect(response).to have_http_status(200)
        end
      end
    end
  end
end
