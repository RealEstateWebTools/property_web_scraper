# PropertyWebScraper

[![Build Status](https://api.travis-ci.org/RealEstateWebTools/property_web_scraper.svg?branch=master)](https://api.travis-ci.org/RealEstateWebTools/property_web_scraper)

This project has been created to address a glaring gap in the rails ecosystem: the lack of an open source project for real estate websites.  

The result is that WordPress has become the dominant tool for creating real estate websites.  This is far from ideal and PropertyWebScraper seeks to address this.

Read more about this here: [http://propertywebbuilder.com](http://propertywebbuilder.com)

##[Demo](https://propertywebbuilder.herokuapp.com/)

You can try out a demo at [https://propertywebbuilder.herokuapp.com](https://propertywebbuilder.herokuapp.com/)

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

Mount the PropertyWebScraper by adding the following to your routes.rb file:
```ruby
mount PropertyWebScraper::Engine => '/'
```

and run the ff commands from the console:
```bash
rails property_web_scraper:install:migrations
rails db:create
rails db:migrate
```


## Contribute and spread the love
We encourage you to contribute to this project and file issues for any problems you encounter.

If you like it, please star it and spread the word on [Twitter](https://twitter.com/prptywebbuilder), [LinkedIn](https://www.linkedin.com/company/propertywebbuilder) and [Facebook](https://www.facebook.com/propertywebbuilder).  You can also subscribe to github notifications on this project.  

Please consider making a contribution to the development of PropertyWebScraper.  If you wish to pay for specific enhancements, please email me directly (opensource at propertywebbuilder.com).


---

## License
The gem is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).

