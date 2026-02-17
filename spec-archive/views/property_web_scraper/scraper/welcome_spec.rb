require 'spec_helper'

module PropertyWebScraper
  RSpec.describe 'scraper/welcome.html.erb', type: :request do
    include_context 'with seeded import hosts'

    it 'renders the hero section' do
      get '/'
      expect(response.body).to include('Extract Property Data from')
      expect(response.body).to include('pws-landing-hero')
    end

    it 'renders the tabbed form with all three modes' do
      get '/'
      expect(response.body).to include('Enter URL')
      expect(response.body).to include('Paste HTML')
      expect(response.body).to include('Upload File')
    end

    it 'renders Stimulus controller data attributes' do
      get '/'
      expect(response.body).to include('data-controller="scraper-form"')
      expect(response.body).to include('data-action="click->scraper-form#switchMode"')
    end

    it 'renders the URL input field' do
      get '/'
      expect(response.body).to include('import_url')
      expect(response.body).to include('pws-url-input')
    end

    it 'renders the HTML textarea (hidden by default)' do
      get '/'
      expect(response.body).to include('html_input')
      expect(response.body).to include('pws-html-textarea')
    end

    it 'renders the file upload input (hidden by default)' do
      get '/'
      expect(response.body).to include('html_file')
      expect(response.body).to include('pws-file-input')
    end

    it 'renders supported sites badges' do
      get '/'
      expect(response.body).to include('idealista.com')
      expect(response.body).to include('rightmove.co.uk')
      expect(response.body).to include('realtor.com')
    end

    it 'renders the results container' do
      get '/'
      expect(response.body).to include('id="retrieve-results"')
    end

    it 'renders the How It Works section' do
      get '/'
      expect(response.body).to include('How It Works')
      expect(response.body).to include('Provide a Source')
      expect(response.body).to include('We Extract Data')
      expect(response.body).to include('Use the Results')
    end

    it 'renders the Why Paste HTML callout' do
      get '/'
      expect(response.body).to include('Why &quot;Paste HTML&quot;').or include('Why "Paste HTML"')
    end
  end
end
