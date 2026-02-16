import { MISSING, INVALID, UNSUPPORTED } from './url-validator.js';

export const ApiErrorCode = {
  MISSING_URL: 'MISSING_URL',
  INVALID_URL: 'INVALID_URL',
  UNSUPPORTED_HOST: 'UNSUPPORTED_HOST',
  MISSING_SCRAPER: 'MISSING_SCRAPER',
  UNAUTHORIZED: 'UNAUTHORIZED',
  LISTING_NOT_FOUND: 'LISTING_NOT_FOUND',
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

const HTTP_STATUS: Record<ApiErrorCodeValue, number> = {
  [ApiErrorCode.MISSING_URL]: 400,
  [ApiErrorCode.INVALID_URL]: 400,
  [ApiErrorCode.UNSUPPORTED_HOST]: 400,
  [ApiErrorCode.MISSING_SCRAPER]: 500,
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.LISTING_NOT_FOUND]: 404,
};

const VALIDATOR_CODE_MAP: Record<string, ApiErrorCodeValue> = {
  [MISSING]: ApiErrorCode.MISSING_URL,
  [INVALID]: ApiErrorCode.INVALID_URL,
  [UNSUPPORTED]: ApiErrorCode.UNSUPPORTED_HOST,
};

export function mapValidatorError(validatorCode: string | undefined): ApiErrorCodeValue {
  return (validatorCode && VALIDATOR_CODE_MAP[validatorCode]) || ApiErrorCode.INVALID_URL;
}

export function errorResponse(code: ApiErrorCodeValue, message: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status: HTTP_STATUS[code], headers: { 'Content-Type': 'application/json' } },
  );
}

export function successResponse(data: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
