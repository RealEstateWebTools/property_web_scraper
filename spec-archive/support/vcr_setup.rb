# VCR Cassette Inventory
#
# All 14 cassettes were recorded in 2017-2018 against live real estate
# websites.  The pages have since changed so the cassettes cannot be
# re-recorded, but they remain valuable as regression tests against
# known HTML snapshots.
#
# Cassettes (spec/fixtures/vcr/scrapers/):
#   cerdfw.yml           – CERDFW listing page (2017)
#   fotocasa.yml         – Fotocasa listing page (2017)
#   idealista_2017.yml   – Idealista listing page (2017)
#   idealista_2018_01.yml – Idealista listing page (Jan 2018)
#   idealista_2018_02.yml – Idealista listing page (Feb 2018)
#   inmo1.yml            – Inmo1 listing page (2017)
#   mlslistings.yml      – MLSListings listing page (2017)
#   pisos_dot_com.yml    – Pisos.com listing page (2017)
#   pwb.yml              – PropertyWebBuilder listing page (2017)
#   realestateindia.yml  – RealEstateIndia listing page (2017)
#   realtor.yml          – Realtor.com listing page (2017)
#   rightmove.yml        – Rightmove listing page (2017)
#   wyomingmls.yml       – Wyoming MLS listing page (2017)
#   zoopla.yml           – Zoopla listing page (2017)
#
VCR.configure do |vc|
  # the directory where your cassettes will be saved
  vc.cassette_library_dir = 'spec/fixtures/vcr'

  # https://relishapp.com/vcr/vcr/v/3-0-3/docs/configuration/ignore-request
  vc.ignore_localhost = true

  vc.allow_http_connections_when_no_cassette = false
  # your HTTP request service.
  vc.hook_into :webmock
end
