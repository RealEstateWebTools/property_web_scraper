import { MISSING, INVALID, UNSUPPORTED } from './url-validator.js';

export const ApiErrorCode = {
  MISSING_URL: 'MISSING_URL',
  INVALID_URL: 'INVALID_URL',
  UNSUPPORTED_HOST: 'UNSUPPORTED_HOST',
  MISSING_SCRAPER: 'MISSING_SCRAPER',
  UNAUTHORIZED: 'UNAUTHORIZED',
  LISTING_NOT_FOUND: 'LISTING_NOT_FOUND',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_CONTENT_TYPE: 'UNSUPPORTED_CONTENT_TYPE',
  FETCH_BLOCKED: 'FETCH_BLOCKED',
  HAUL_LIMIT_REACHED: 'HAUL_LIMIT_REACHED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

const HTTP_STATUS: Record<ApiErrorCodeValue, number> = {
  [ApiErrorCode.MISSING_URL]: 400,
  [ApiErrorCode.INVALID_URL]: 400,
  [ApiErrorCode.UNSUPPORTED_HOST]: 400,
  [ApiErrorCode.INVALID_REQUEST]: 400,
  [ApiErrorCode.MISSING_SCRAPER]: 500,
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.LISTING_NOT_FOUND]: 404,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.RATE_LIMITED]: 429,
  [ApiErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ApiErrorCode.UNSUPPORTED_CONTENT_TYPE]: 415,
  [ApiErrorCode.FETCH_BLOCKED]: 422,
  [ApiErrorCode.HAUL_LIMIT_REACHED]: 402,
  [ApiErrorCode.EMAIL_NOT_VERIFIED]: 403,
};

const VALIDATOR_CODE_MAP: Record<string, ApiErrorCodeValue> = {
  [MISSING]: ApiErrorCode.MISSING_URL,
  [INVALID]: ApiErrorCode.INVALID_URL,
  [UNSUPPORTED]: ApiErrorCode.UNSUPPORTED_HOST,
};

export function mapValidatorError(validatorCode: string | undefined): ApiErrorCodeValue {
  return (validatorCode && VALIDATOR_CODE_MAP[validatorCode]) || ApiErrorCode.INVALID_URL;
}

function getAllowedOrigins(): string[] {
  let raw = '';
  try {
    raw = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.PWS_ALLOWED_ORIGINS || '').trim();
  } catch {
    raw = '';
  }
  if (!raw && typeof process !== 'undefined') {
    raw = (process.env.PWS_ALLOWED_ORIGINS || '').trim();
  }
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function resolveAllowOrigin(request?: Request): { allowOrigin: string | null; usingAllowlist: boolean } {
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) {
    return { allowOrigin: '*', usingAllowlist: false };
  }

  const fallbackOrigin = allowedOrigins[0];
  if (!request) {
    return { allowOrigin: fallbackOrigin, usingAllowlist: true };
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    return { allowOrigin: fallbackOrigin, usingAllowlist: true };
  }

  if (allowedOrigins.includes(origin)) {
    return { allowOrigin: origin, usingAllowlist: true };
  }

  // Allow Chrome extension origins
  if (origin.startsWith('chrome-extension://')) {
    return { allowOrigin: origin, usingAllowlist: true };
  }

  return { allowOrigin: null, usingAllowlist: true };
}

export function buildCorsHeaders(request?: Request): Record<string, string> {
  const { allowOrigin, usingAllowlist } = resolveAllowOrigin(request);
  const headers: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization',
};
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }
  if (usingAllowlist) {
    headers['Vary'] = 'Origin';
  }
  return headers;
}

function normalizeErrorResponseArgs(
  extraHeadersOrRequest?: Record<string, string> | Request,
  request?: Request
): { extraHeaders?: Record<string, string>; request?: Request } {
  if (extraHeadersOrRequest instanceof Request) {
    return { request: extraHeadersOrRequest };
  }
  return { extraHeaders: extraHeadersOrRequest, request };
}

export function errorResponse(
  code: ApiErrorCodeValue,
  message: string,
  extraHeadersOrRequest?: Record<string, string> | Request,
  request?: Request
): Response {
  const normalized = normalizeErrorResponseArgs(extraHeadersOrRequest, request);
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    {
      status: HTTP_STATUS[code],
      headers: {
        'Content-Type': 'application/json',
        ...buildCorsHeaders(normalized.request),
        ...(normalized.extraHeaders || {}),
      },
    },
  );
}

export function successResponse(data: Record<string, unknown>, request?: Request, statusCode = 200): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { status: statusCode, headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request) } },
  );
}

export function corsPreflightResponse(request?: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...buildCorsHeaders(request),
      'Content-Length': '0',
    },
  });
}
