# PWB as used by [https://homestocompare.com/](https://homestocompare.com/)

Great new for anyone interested in this project, a US appeals court has recently reaffirmed that web scraping is legal!!

https://techcrunch.com/2022/04/18/web-scraping-legal-court/amp/

I am currently a bit busy with this project (which also also allows you to scrape real estate websites ;) [https://propertysquares.com/](https://propertysquares.com/) but will return to update it shortly.

Please get in touch if you are interested in helping me take this project forward.


## [Demo of PropertyWebScraper ](https://homestocompare.com/)

Previously there was a demo at [https://real-estate-web-scraper.herokuapp.com](https://real-estate-web-scraper.herokuapp.com/)

I have had to take that down as heroku has cancelled thier free tier.  You can see it being used in production here though: [https://homestocompare.com/](https://homestocompare.com/)

To use Property Web Scraper as a service you would make calls like:

[https://real-estate-web-scraper.herokuapp.com/retriever/as_json?url=https%3A%2F%2Fwww.rightmove.co.uk%2Fproperty-for-sale%2Fproperty-68790657.html](https://real-estate-web-scraper.herokuapp.com/retriever/as_json?url=https%3A%2F%2Fwww.rightmove.co.uk%2Fproperty-for-sale%2Fproperty-68790657.html)

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
