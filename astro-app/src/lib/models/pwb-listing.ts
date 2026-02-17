import { Listing } from './listing.js';

/**
 * Extended listing with PropertyWebBuilder-compatible serialization.
 * Port of Ruby PropertyWebScraper::PwbListing.
 */
export class PwbListing extends Listing {
  get priceSaleCurrent(): number {
    return this.for_sale ? this.price_float : 0;
  }

  get priceRentalMonthlyCurrent(): number {
    return this.for_rent_long_term ? this.price_float : 0;
  }

  get propertyPhotos(): Array<{ url: string }> {
    return (this.image_urls || []).map((img) => ({ url: img.url }));
  }

  override asJson(): Record<string, unknown> {
    const base = super.asJson([
      'reference', 'locale_code', 'title', 'description',
      'area_unit', 'plot_area', 'constructed_area',
      'count_bedrooms', 'count_bathrooms', 'count_toilets', 'count_garages',
      'currency', 'street_number', 'street_name', 'street_address', 'postal_code',
      'city', 'province', 'region', 'country',
      'longitude', 'latitude', 'for_sale', 'for_rent_long_term',
      'for_rent_short_term', 'features',
    ]);
    return {
      ...base,
      property_photos: this.propertyPhotos,
      price_rental_monthly_current: this.priceRentalMonthlyCurrent,
      price_sale_current: this.priceSaleCurrent,
    };
  }
}
