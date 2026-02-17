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
