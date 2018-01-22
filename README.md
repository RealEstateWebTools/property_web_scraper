# PropertyWebScraper

Please help support this project by making a contribution to PropertyWebBuilder here:
[https://opencollective.com/property_web_builder](https://opencollective.com/property_web_builder)

[![Build Status](https://api.travis-ci.org/RealEstateWebTools/property_web_scraper.svg?branch=master)](https://api.travis-ci.org/RealEstateWebTools/property_web_scraper)

This project was created while I was working on another open source product called [PropertyWebBuilder](https://github.com/etewiah/property_web_builder) which allows real estate agents to create their own website with ease.  I wanted to provide a way to allow people to import their listings from other websites and found there was no easy way to do this.

The aim of PropertyWebScraper is to make it easy for anyone to import real estate data from any website.  Support for more and more websites will be added over time.

You can read more about PropertyWebBuilder here: [http://propertywebbuilder.com](http://propertywebbuilder.com) or deploy it on heroku by clicking below:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/etewiah/pwb-for-heroku)


## [Demo of PropertyWebScraper ](https://real-estate-web-scraper.herokuapp.com/)

You can try out a demo at [https://real-estate-web-scraper.herokuapp.com](https://real-estate-web-scraper.herokuapp.com/)

## Support for importing properties from an MLS

PropertyWebScraper also supports connecting to different MLSs (Multiple Listing Services) in the US using RETS and Web Services.  This functionality is currently experimental and has only been implemented for 3 MLSs.  If there is a particular MLS for which you need support, open an issue with the details.   

## Rails Version

PropertyWebScraper runs with Rails >= 5.0

## Ruby Version

PropertyWebScraper runs with Ruby >= 2.0.0.


## Installation

Install into an existing Rails project by adding these lines in your applications's Gemfile:

```ruby
gem 'property_web_scraper', git: 'https://github.com/RealEstateWebTools/property_web_scraper', branch: 'master'
```

Also, be sure to use Postgres as your database (by having the "pg" gem and Postgres installed locally 
And then execute:
```bash
$ bundle
```

Mount PropertyWebScraper by adding the following to your routes.rb file:
```ruby
mount PropertyWebScraper::Engine => '/'
```

and run the ff commands from the console:
```bash
rails property_web_scraper:install:migrations
rails db:create
rails db:migrate
rails property_web_scraper:db:seed
```


## Contribute and spread the love
We encourage you to contribute to this project and file issues for any problems you encounter.

If you like it, please star it and spread the word on [Twitter](https://twitter.com/prptywebbuilder), [LinkedIn](https://www.linkedin.com/company/propertywebbuilder) and [Facebook](https://www.facebook.com/propertywebbuilder).  You can also subscribe to github notifications on this project.  

Please consider making a contribution to the development of PropertyWebScraper.  If you wish to pay for specific enhancements, please email me directly (opensource at propertywebbuilder.com).

Or make a contribution to PropertyWebBuilder here:
[https://opencollective.com/property_web_builder](https://opencollective.com/property_web_builder)

---

## License

The gem is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).

## Disclaimer

While scraping can sometimes be used as a legitimate way to access all kinds of data on the internet, it’s also important to consider the legal implications. There are cases where scraping data may be considered illegal, or open you to the possibility of being sued. 

I created this tool in part as a learning exercise and am sharing it in case others find it useful. If you do decide to use this tool to scrape a website it is your responsibilty to ensure that what you are doing is legal.
