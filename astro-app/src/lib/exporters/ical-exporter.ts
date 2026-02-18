/**
 * iCalendar Exporter
 * Exports rental listings with availability dates as .ics calendar entries
 */

import { BaseExporter, type ExportOptions } from './base-exporter.js';
import type { Listing } from '../models/listing.js';

export interface ICalExportOptions extends ExportOptions {
  /** Default event duration in days when only start date is available */
  defaultDurationDays?: number;
}

export class ICalExporter extends BaseExporter {
  protected format = 'icalendar';

  constructor(options: ICalExportOptions = {}) {
    super({
      fieldSelection: 'all',
      ...options,
    });
  }

  async export(listings: Listing[]): Promise<string> {
    this.validateListings(listings);
    this.resetTimer();

    const lines: string[] = [];
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//PropertyWebScraper//Export//EN');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');

    for (const listing of listings) {
      const event = this.listingToVEvent(listing);
      if (event) {
        lines.push(...event);
      }
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  private listingToVEvent(listing: Listing): string[] | null {
    // Determine dates — use rental availability if present, otherwise use active_from/last_retrieved_at
    const startDate = this.resolveDate(
      (listing as any).available_to_rent_from ||
      (listing as any).active_from ||
      listing.last_retrieved_at
    );

    if (!startDate) return null;

    const defaultDays = (this.options as ICalExportOptions).defaultDurationDays || 365;
    const endDate = this.resolveDate((listing as any).available_to_rent_till);
    const dtEnd = endDate || new Date(startDate.getTime() + defaultDays * 86400000);

    const uid = listing.reference
      ? `${listing.reference}@propertyscraper`
      : `${Date.now()}-${Math.random().toString(36).slice(2)}@propertyscraper`;

    const summary = foldLine('SUMMARY:' + escapeIcalText(listing.title || 'Property Listing'));
    const description = listing.description
      ? foldLine('DESCRIPTION:' + escapeIcalText(truncate(stripHtml(listing.description), 500)))
      : null;

    const lines: string[] = [];
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
    lines.push(`DTSTART;VALUE=DATE:${formatIcalDateOnly(startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatIcalDateOnly(dtEnd)}`);
    lines.push(summary);

    if (description) lines.push(description);

    if (listing.address_string) {
      lines.push(foldLine('LOCATION:' + escapeIcalText(listing.address_string)));
    }

    if (listing.latitude && listing.longitude) {
      lines.push(`GEO:${listing.latitude};${listing.longitude}`);
    }

    if (listing.import_url) {
      lines.push(foldLine('URL:' + listing.import_url));
    }

    if (listing.price_string) {
      lines.push(foldLine('X-PRICE:' + escapeIcalText(listing.price_string + (listing.currency ? ' ' + listing.currency : ''))));
    }

    lines.push('END:VEVENT');
    return lines;
  }

  private resolveDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'number') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatIcalDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function escapeIcalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  // iCalendar lines should be max 75 octets; fold with CRLF + space
  if (line.length <= 75) return line;
  const parts: string[] = [];
  parts.push(line.slice(0, 75));
  let offset = 75;
  while (offset < line.length) {
    parts.push(' ' + line.slice(offset, offset + 74));
    offset += 74;
  }
  return parts.join('\r\n');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}
