module PropertyWebScraper
  # Base helper module for PropertyWebScraper views.
  module ApplicationHelper
    include ActionView::Helpers::SanitizeHelper

    # Sanitizes HTML content, allowing only safe tags and attributes.
    #
    # @param html [String] the HTML string to sanitize
    # @return [String] sanitized HTML
    def sanitize_html(html)
      sanitize(html, tags: %w[p br b i u em strong a ul ol li h1 h2 h3 h4 h5 h6 div span table tr td th thead tbody img],
                      attributes: %w[href src alt title class style target])
    end
  end
end
