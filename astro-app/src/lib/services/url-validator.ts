import { ImportHost } from '../models/import-host.js';

export interface ValidationResult {
  valid: boolean;
  uri?: URL;
  importHost?: ImportHost;
  errorMessage?: string;
  errorCode?: string;
}

export const MISSING = 'missing';
export const INVALID = 'invalid';
export const UNSUPPORTED = 'unsupported';

/**
 * Validate and parse a URL for use with the scraper.
 * Port of Ruby UrlValidator.call.
 */
export async function validateUrl(url: string | undefined | null): Promise<ValidationResult> {
  if (!url || url.trim() === '') {
    return { valid: false, errorCode: MISSING, errorMessage: 'Please provide a url' };
  }

  const stripped = url.trim();
  let uri: URL;
  try {
    uri = new URL(stripped);
  } catch {
    return { valid: false, errorCode: INVALID, errorMessage: 'Please provide a valid url' };
  }

  if (uri.protocol !== 'http:' && uri.protocol !== 'https:') {
    return { valid: false, errorCode: INVALID, errorMessage: 'Please provide a valid url' };
  }

  const importHost = await ImportHost.findByHost(uri.hostname);
  if (!importHost) {
    return {
      valid: false,
      errorCode: UNSUPPORTED,
      errorMessage: 'Sorry, the url provided is currently not supported',
    };
  }

  return { valid: true, uri, importHost };
}
