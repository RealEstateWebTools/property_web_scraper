module PropertyWebScraper
  # Base mailer class for PropertyWebScraper email delivery.
  class ApplicationMailer < ActionMailer::Base
    default from: 'from@example.com'
    layout 'mailer'
  end
end
