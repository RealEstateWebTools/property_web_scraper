# PropertyWebScraper

[![CI](https://github.com/RealEstateWebTools/property_web_scraper/actions/workflows/ci.yml/badge.svg)](https://github.com/RealEstateWebTools/property_web_scraper/actions/workflows/ci.yml)

Web based UI to make scraping data from real estate websites super simple.

## Requirements

- Ruby >= 3.1
- Rails >= 7.1
- PostgreSQL

## Installation

Install into an existing Rails project by adding this line to your application's Gemfile:

```ruby
gem 'property_web_scraper', git: 'https://github.com/RealEstateWebTools/property_web_scraper', branch: 'master'
```

Also, be sure to use Postgres as your database (by having the "pg" gem and Postgres installed locally).

Then execute:
```bash
$ bundle
```

Mount PropertyWebScraper by adding the following to your routes.rb file:
```ruby
mount PropertyWebScraper::Engine => '/'
```

And run the following commands from the console:
```bash
rails property_web_scraper:install:migrations
rails db:create
rails db:migrate
rails property_web_scraper:db:seed
```

## Contribute and spread the love

We encourage you to contribute to this project and file issues for any problems you encounter.

If you like it, please star it and spread the word on [Twitter](https://twitter.com/prptywebbuilder), [LinkedIn](https://www.linkedin.com/company/propertywebbuilder) and [Facebook](https://www.facebook.com/propertywebbuilder). You can also subscribe to GitHub notifications on this project.

Please consider making a contribution to the development of PropertyWebScraper. If you wish to pay for specific enhancements, please email me directly (opensource at propertywebbuilder.com).

---

## License

The gem is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).

## Disclaimer

While scraping can sometimes be used as a legitimate way to access all kinds of data on the internet, it's also important to consider the legal implications. There are cases where scraping data may be considered illegal, or open you to the possibility of being sued.

I created this tool in part as a learning exercise and am sharing it in case others find it useful. If you do decide to use this tool to scrape a website it is your responsibility to ensure that what you are doing is legal.
