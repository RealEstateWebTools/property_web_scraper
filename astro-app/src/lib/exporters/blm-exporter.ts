/**
 * BLM Exporter (Rightmove / Zoopla feed format)
 * Pipe-delimited format with #HEADER#, #DEFINITION#, #DATA#, #END# sections.
 */

import { BaseExporter, type ExportOptions } from './base-exporter.js';
import type { Listing } from '../models/listing.js';
import { getMappingsForStandard } from './field-mappings.js';

export interface BLMExportOptions extends ExportOptions {
  version?: string;
}

/** BLM column definitions in order */
const BLM_COLUMNS = [
  'AGENT_REF', 'ADDRESS_1', 'ADDRESS_2', 'TOWN', 'COUNTY', 'POSTCODE1', 'POSTCODE2',
  'DISPLAY_ADDRESS', 'COUNTRY',
  'PROP_SUB_ID', 'PROP_SUB_ID_2',
  'SUMMARY', 'DESCRIPTION',
  'PRICE', 'PRICE_DISPLAY', 'PRICE_QUALIFIER', 'CURRENCY',
  'TRANS_TYPE_ID', 'STATUS_ID', 'TENURE_TYPE_ID',
  'BEDROOMS', 'BATHROOMS', 'TOILETS', 'PARKING',
  'SIZE', 'SIZE_UNITS', 'PLOT_SIZE', 'YEAR_BUILT',
  'EPC_RATING', 'EPC_LETTER',
  'FURNISHED',
  'AGENT_NAME', 'AGENT_PHONE', 'AGENT_EMAIL', 'AGENT_LOGO',
  'LATITUDE', 'LONGITUDE', 'URL',
  'FEATURE1', 'FEATURE2', 'FEATURE3', 'FEATURE4', 'FEATURE5',
  'FEATURE6', 'FEATURE7', 'FEATURE8', 'FEATURE9', 'FEATURE10',
  'MEDIA_IMAGE_00', 'MEDIA_IMAGE_01', 'MEDIA_IMAGE_02', 'MEDIA_IMAGE_03',
  'MEDIA_IMAGE_04', 'MEDIA_IMAGE_05', 'MEDIA_IMAGE_06', 'MEDIA_IMAGE_07',
  'MEDIA_IMAGE_08', 'MEDIA_IMAGE_09',
  'MEDIA_FLOOR_PLAN_00', 'MEDIA_FLOOR_PLAN_01',
];

/** Reverse mapping from BLM column name back to internal field name */
function buildReverseBLMMap(): Record<string, string> {
  const mappings = getMappingsForStandard('blm');
  const reverse: Record<string, string> = {};
  for (const [internal, blm] of Object.entries(mappings)) {
    reverse[blm] = internal;
  }
  return reverse;
}

function escapeBLM(value: string): string {
  return value.replace(/\^/g, '').replace(/~/g, '');
}

function splitPostcode(postcode: string): [string, string] {
  const trimmed = postcode.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return [trimmed, ''];
  return [trimmed.slice(0, lastSpace), trimmed.slice(lastSpace + 1)];
}

export class BLMExporter extends BaseExporter {
  protected format = 'blm';

  constructor(options: BLMExportOptions = {}) {
    super({
      fieldSelection: 'all',
      ...options,
    });
  }

  async export(listings: Listing[]): Promise<string> {
    this.validateListings(listings);
    this.resetTimer();

    const version = (this.options as BLMExportOptions).version || '3i';
    const lines: string[] = [];

    // #HEADER#
    lines.push('#HEADER#');
    lines.push(`Version : ${version}`);
    lines.push("EOF : '^'");
    lines.push("EOR : '~'");

    // #DEFINITION#
    lines.push('#DEFINITION#');
    lines.push(BLM_COLUMNS.join('^') + '^~');

    // #DATA#
    lines.push('#DATA#');

    const reverseMap = buildReverseBLMMap();

    for (const listing of listings) {
      const values = this.extractBLMValues(listing, reverseMap);
      const row = BLM_COLUMNS.map(col => escapeBLM(String(values[col] ?? ''))).join('^');
      lines.push(row + '^~');
    }

    // #END#
    lines.push('#END#');

    return lines.join('\n');
  }

  private extractBLMValues(
    listing: Listing,
    reverseMap: Record<string, string>,
  ): Record<string, string | number> {
    const values: Record<string, string | number> = {};
    const rec = listing as unknown as Record<string, unknown>;

    // Map standard fields via reverse lookup
    for (const col of BLM_COLUMNS) {
      const internalField = reverseMap[col];
      if (internalField && internalField in rec) {
        const val = rec[internalField];
        if (val != null && val !== '' && val !== 0 && val !== false) {
          values[col] = typeof val === 'number' ? val : String(val);
        }
      }
    }

    // Split postcode into POSTCODE1/POSTCODE2
    if (listing.postal_code) {
      const [pc1, pc2] = splitPostcode(listing.postal_code);
      values['POSTCODE1'] = pc1;
      values['POSTCODE2'] = pc2;
    }

    // TRANS_TYPE_ID: 1 = for sale, 2 = to let
    if (listing.for_sale) {
      values['TRANS_TYPE_ID'] = '1';
    } else if (listing.for_rent) {
      values['TRANS_TYPE_ID'] = '2';
    }

    // Flatten features into FEATURE1-FEATURE10
    if (listing.features && listing.features.length > 0) {
      const maxFeatures = Math.min(listing.features.length, 10);
      for (let i = 0; i < maxFeatures; i++) {
        values[`FEATURE${i + 1}`] = String(listing.features[i]);
      }
    }

    // Flatten image_urls into MEDIA_IMAGE_00-MEDIA_IMAGE_09
    if (listing.image_urls && listing.image_urls.length > 0) {
      const maxImages = Math.min(listing.image_urls.length, 10);
      for (let i = 0; i < maxImages; i++) {
        const img = listing.image_urls[i];
        const url = typeof img === 'string' ? img : (img as any).url;
        if (url) {
          values[`MEDIA_IMAGE_${String(i).padStart(2, '0')}`] = url;
        }
      }
    }

    // Flatten floor_plan_urls into MEDIA_FLOOR_PLAN_00-MEDIA_FLOOR_PLAN_01
    if (listing.floor_plan_urls && listing.floor_plan_urls.length > 0) {
      const maxPlans = Math.min(listing.floor_plan_urls.length, 2);
      for (let i = 0; i < maxPlans; i++) {
        values[`MEDIA_FLOOR_PLAN_${String(i).padStart(2, '0')}`] = listing.floor_plan_urls[i];
      }
    }

    return values;
  }
}
