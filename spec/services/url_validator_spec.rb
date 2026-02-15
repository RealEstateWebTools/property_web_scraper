require 'spec_helper'

module PropertyWebScraper
  RSpec.describe UrlValidator do
    include_context 'with seeded import hosts'

    describe '.call' do
      it 'returns invalid for nil' do
        result = UrlValidator.call(nil)
        expect(result.valid?).to eq(false)
        expect(result.error_code).to eq(UrlValidator::MISSING)
        expect(result.error_message).to include('provide a url')
      end

      it 'returns invalid for empty string' do
        result = UrlValidator.call('')
        expect(result.valid?).to eq(false)
        expect(result.error_code).to eq(UrlValidator::MISSING)
      end

      it 'returns invalid for non-HTTP URI' do
        result = UrlValidator.call('ftp://example.com/file')
        expect(result.valid?).to eq(false)
        expect(result.error_code).to eq(UrlValidator::INVALID)
        expect(result.error_message).to include('valid url')
      end

      it 'returns invalid for malformed URI' do
        result = UrlValidator.call('ht tp://bad url')
        expect(result.valid?).to eq(false)
        expect(result.error_code).to eq(UrlValidator::INVALID)
      end

      it 'returns unsupported for unknown host' do
        result = UrlValidator.call('https://www.unknown-host.com/page')
        expect(result.valid?).to eq(false)
        expect(result.error_code).to eq(UrlValidator::UNSUPPORTED)
        expect(result.error_message).to include('not supported')
      end

      it 'returns valid for a known host' do
        result = UrlValidator.call('https://www.idealista.com/inmueble/123/')
        expect(result.valid?).to eq(true)
        expect(result.uri).to be_a(URI::HTTPS)
        expect(result.import_host).to be_a(ImportHost)
        expect(result.import_host.slug).to eq('idealista')
        expect(result.error_message).to be_nil
      end

      it 'strips leading and trailing whitespace' do
        result = UrlValidator.call('  https://www.idealista.com/inmueble/123/  ')
        expect(result.valid?).to eq(true)
        expect(result.uri.to_s).to eq('https://www.idealista.com/inmueble/123/')
      end

      it 'works with HTTP URLs' do
        result = UrlValidator.call('http://www.realtor.com/property/123')
        expect(result.valid?).to eq(true)
        expect(result.uri).to be_a(URI::HTTP)
      end
    end
  end
end
