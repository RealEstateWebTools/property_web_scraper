import { describe, it, expect } from 'vitest';
import {
  ApiErrorCode,
  errorResponse,
  successResponse,
  mapValidatorError,
} from '../../src/lib/services/api-response.js';

describe('api-response', () => {
  describe('errorResponse', () => {
    it('returns 400 for MISSING_URL', async () => {
      const res = errorResponse(ApiErrorCode.MISSING_URL, 'Please provide a url');
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toEqual({
        success: false,
        error: { code: 'MISSING_URL', message: 'Please provide a url' },
      });
    });

    it('returns 400 for INVALID_URL', async () => {
      const res = errorResponse(ApiErrorCode.INVALID_URL, 'Please provide a valid url');
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_URL');
    });

    it('returns 400 for UNSUPPORTED_HOST', async () => {
      const res = errorResponse(ApiErrorCode.UNSUPPORTED_HOST, 'Not supported');
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('UNSUPPORTED_HOST');
    });

    it('returns 500 for MISSING_SCRAPER', async () => {
      const res = errorResponse(ApiErrorCode.MISSING_SCRAPER, 'No scraper mapping found');
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error.code).toBe('MISSING_SCRAPER');
    });

    it('returns 401 for UNAUTHORIZED', async () => {
      const res = errorResponse(ApiErrorCode.UNAUTHORIZED, 'Unauthorized');
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 404 for LISTING_NOT_FOUND', async () => {
      const res = errorResponse(ApiErrorCode.LISTING_NOT_FOUND, 'Listing not found');
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('LISTING_NOT_FOUND');
    });

    it('sets Content-Type to application/json', () => {
      const res = errorResponse(ApiErrorCode.MISSING_URL, 'test');
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('always sets success to false', async () => {
      const res = errorResponse(ApiErrorCode.UNAUTHORIZED, 'Unauthorized');
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('successResponse', () => {
    it('returns 200 with success: true and merged data', async () => {
      const res = successResponse({ listings: [{ id: '1' }], count: 1 });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true, listings: [{ id: '1' }], count: 1 });
    });

    it('sets Content-Type to application/json', () => {
      const res = successResponse({});
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('works with empty data', async () => {
      const res = successResponse({});
      const json = await res.json();
      expect(json).toEqual({ success: true });
    });
  });

  describe('mapValidatorError', () => {
    it('maps "missing" to MISSING_URL', () => {
      expect(mapValidatorError('missing')).toBe('MISSING_URL');
    });

    it('maps "invalid" to INVALID_URL', () => {
      expect(mapValidatorError('invalid')).toBe('INVALID_URL');
    });

    it('maps "unsupported" to UNSUPPORTED_HOST', () => {
      expect(mapValidatorError('unsupported')).toBe('UNSUPPORTED_HOST');
    });

    it('defaults to INVALID_URL for unknown codes', () => {
      expect(mapValidatorError('unknown')).toBe('INVALID_URL');
    });

    it('defaults to INVALID_URL for undefined', () => {
      expect(mapValidatorError(undefined)).toBe('INVALID_URL');
    });
  });
});
