let validated = false;

/**
 * Validate environment configuration once per runtime instance.
 * Emits warnings for non-fatal misconfiguration.
 */
export function validateEnv(): void {
  if (validated) return;
  validated = true;

  const warnings: string[] = [];

  if (!import.meta.env.PWS_API_KEY) {
    warnings.push('PWS_API_KEY is not set; public API authentication is disabled.');
  }

  if (!import.meta.env.FIRESTORE_PROJECT_ID) {
    warnings.push('FIRESTORE_PROJECT_ID is not set; Firestore persistence may be unavailable.');
  }

  if (warnings.length > 0) {
    console.warn('[Env] Configuration warnings:');
    for (const warning of warnings) {
      console.warn(`[Env] - ${warning}`);
    }
  }
}

export interface EnvVarInfo {
  name: string;
  configured: boolean;
  required: boolean;
  description: string;
}

const ENV_VAR_DEFINITIONS: Array<Omit<EnvVarInfo, 'configured'>> = [
  { name: 'FIRESTORE_PROJECT_ID', required: false, description: 'Google Cloud project ID for Firestore' },
  { name: 'GOOGLE_SERVICE_ACCOUNT_JSON', required: false, description: 'Service account credentials (inline JSON)' },
  { name: 'FIRESTORE_COLLECTION_PREFIX', required: false, description: 'Prefix for Firestore collection names' },
  { name: 'GOOGLE_MAPS_API_KEY', required: false, description: 'Google Maps API key for geocoding' },
  { name: 'PWS_API_KEY', required: false, description: 'API key for public extraction endpoints' },
  { name: 'PWS_ADMIN_KEY', required: false, description: 'Admin authentication key' },
  { name: 'PWS_RATE_LIMIT', required: false, description: 'Custom rate limit (requests/min)' },
  { name: 'PWS_ALLOWED_ORIGINS', required: false, description: 'Comma-separated CORS allowed origins' },
];

export function getEnvStatus(): EnvVarInfo[] {
  return ENV_VAR_DEFINITIONS.map((def) => ({
    ...def,
    configured: !!import.meta.env[def.name],
  }));
}
