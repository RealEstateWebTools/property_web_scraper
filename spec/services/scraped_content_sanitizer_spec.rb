require 'spec_helper'

module PropertyWebScraper
  RSpec.describe ScrapedContentSanitizer do
    describe '.call' do
      it 'strips HTML tags from text fields' do
        hash = { 'title' => '<b>Nice</b> house', 'description' => '<script>alert("xss")</script>A home' }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['title']).to eq('Nice house')
        expect(result['description']).to eq('A home')
      end

      it 'passes through clean text unchanged' do
        hash = { 'title' => 'Clean title', 'description' => 'Clean desc' }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['title']).to eq('Clean title')
        expect(result['description']).to eq('Clean desc')
      end

      it 'rejects javascript: URLs in main_image_url' do
        hash = { 'main_image_url' => 'javascript:alert(1)' }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['main_image_url']).to be_nil
      end

      it 'keeps valid HTTP URLs in main_image_url' do
        hash = { 'main_image_url' => 'https://example.com/img.jpg' }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['main_image_url']).to eq('https://example.com/img.jpg')
      end

      it 'fixes protocol-relative URLs in main_image_url' do
        hash = { 'main_image_url' => '//cdn.example.com/img.jpg' }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['main_image_url']).to eq('https://cdn.example.com/img.jpg')
      end

      it 'filters invalid URLs from image_urls array' do
        hash = {
          'image_urls' => [
            'https://example.com/1.jpg',
            'javascript:alert(1)',
            '//cdn.example.com/2.jpg',
            'data:image/png;base64,abc',
            'https://example.com/3.jpg'
          ]
        }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['image_urls']).to eq([
          'https://example.com/1.jpg',
          'https://cdn.example.com/2.jpg',
          'https://example.com/3.jpg'
        ])
      end

      it 'sanitizes features array' do
        hash = { 'features' => ['<b>Pool</b>', 'Garden', '<script>x</script>Patio'] }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['features']).to eq(['Pool', 'Garden', 'Patio'])
      end

      it 'handles nil values gracefully' do
        hash = { 'title' => nil, 'main_image_url' => nil, 'image_urls' => nil }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['title']).to be_nil
        expect(result['main_image_url']).to be_nil
        expect(result['image_urls']).to be_nil
      end

      it 'strips whitespace from text fields' do
        hash = { 'title' => '  Spacious apartment  ' }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['title']).to eq('Spacious apartment')
      end

      it 'rejects data: scheme URLs' do
        hash = { 'main_image_url' => 'data:image/png;base64,abc123' }
        result = ScrapedContentSanitizer.call(hash)
        expect(result['main_image_url']).to be_nil
      end
    end
  end
end
