# API Error Codes

| Code | HTTP Status | Description | Typical Resolution |
|------|-------------|-------------|--------------------|
| `MISSING_URL` | 400 | URL is missing from the request. | Provide a `url` field or query parameter. |
| `INVALID_URL` | 400 | URL is malformed or too long. | Send a valid `http`/`https` URL under 2048 chars. |
| `UNSUPPORTED_HOST` | 400 | Host is not in the supported portal list. | Use a supported host from `/public_api/v1/supported_sites`. |
| `UNAUTHORIZED` | 401 | API key is missing or invalid. | Provide a valid `X-Api-Key` header. |
| `LISTING_NOT_FOUND` | 404 | Listing ID does not exist. | Check the listing ID and retry. |
| `PAYLOAD_TOO_LARGE` | 413 | HTML payload exceeds size limit. | Send smaller HTML content (max 10MB). |
| `UNSUPPORTED_CONTENT_TYPE` | 415 | Request body type is unsupported. | Use `application/json` or `multipart/form-data`. |
| `RATE_LIMITED` | 429 | Too many requests in a short window. | Retry after the `retry_after_seconds` value. |
| `MISSING_SCRAPER` | 500 | No mapping exists for the validated host. | Check scraper setup and host mapping. |
