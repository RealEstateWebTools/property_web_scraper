/**
 * Converts enriched HaulScrape objects into Listing instances
 * so the existing ExportService pipeline works unchanged.
 */

import { Listing } from '../models/listing.js';
import type { HaulScrape } from './haul-store.js';

export function haulScrapeToListing(scrape: HaulScrape): Listing {
  const listing = new Listing();

  listing.import_url = scrape.url;
  listing.title = scrape.title || '';
  listing.price_string = scrape.price || '';
  listing.price_float = scrape.price_float ?? 0;
  listing.currency = scrape.currency ?? '';
  listing.count_bedrooms = scrape.count_bedrooms ?? 0;
  listing.count_bathrooms = scrape.count_bathrooms ?? 0;
  listing.constructed_area = scrape.constructed_area ?? 0;
  listing.area_unit = scrape.area_unit ?? 'sqmt';
  listing.latitude = scrape.latitude ?? 0;
  listing.longitude = scrape.longitude ?? 0;
  listing.city = scrape.city ?? '';
  listing.country = scrape.country ?? '';
  listing.address_string = scrape.address_string ?? '';
  listing.main_image_url = scrape.main_image_url ?? '';
  listing.import_host_slug = scrape.import_host_slug ?? '';
  listing.for_sale = scrape.for_sale ?? false;
  listing.for_rent = scrape.for_rent ?? false;
  listing.features = scrape.features ?? [];
  listing.description = scrape.description ?? '';
  listing.description_html = scrape.description_html ?? '';
  listing.property_type = scrape.property_type ?? '';
  listing.property_subtype = scrape.property_subtype ?? '';
  listing.tenure = scrape.tenure ?? '';
  listing.listing_status = scrape.listing_status ?? '';
  listing.agent_name = scrape.agent_name ?? '';
  listing.agent_phone = scrape.agent_phone ?? '';
  listing.agent_email = scrape.agent_email ?? '';
  listing.agent_logo_url = scrape.agent_logo_url ?? '';
  listing.price_qualifier = scrape.price_qualifier ?? '';
  listing.floor_plan_urls = scrape.floor_plan_urls ?? [];
  listing.energy_certificate_grade = scrape.energy_certificate_grade ?? '';

  return listing;
}

export function haulScrapesToListings(scrapes: HaulScrape[]): Listing[] {
  return scrapes.map(haulScrapeToListing);
}
