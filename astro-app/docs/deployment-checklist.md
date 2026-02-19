# Deployment Checklist

## Pre-Deployment
- [ ] Run unit tests: `npm run test`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Verify TypeScript: `npx tsc --noEmit`
- [ ] Confirm required environment variables are configured
- [ ] Confirm API keys and admin keys are valid

## Environment Variables
- [ ] `FIRESTORE_PROJECT_ID` — Google Cloud project ID
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` — path to service account JSON
- [ ] `PWS_API_KEY` — API key for public endpoints
- [ ] `PWS_ADMIN_KEY` — admin dashboard key
- [ ] `PWS_ALLOWED_ORIGINS` — CORS allowed origins (default `*`)
- [ ] `PWS_RATE_LIMIT` — requests per minute (default 60)
- [ ] `STRIPE_SECRET_KEY` — Stripe billing (if enabled)
- [ ] `STRIPE_WEBHOOK_SECRET` — Stripe webhook verification (if enabled)

## Cloudflare Pages Deployment
- [ ] Ensure `astro.config.mjs` uses the Cloudflare adapter
- [ ] Build application: `npm run build`
- [ ] Verify KV namespace bindings are configured in `wrangler.toml` or Cloudflare dashboard
  - `PWS_LISTINGS` — listing storage
  - `PWS_HAULS` — haul collection storage
- [ ] Set environment variables in Cloudflare Pages dashboard (Settings > Environment Variables)
- [ ] Deploy to staging/preview branch first
- [ ] Verify staging health check: `curl https://<preview-url>/health`
- [ ] Test key API endpoints in staging
- [ ] Merge to production branch (or deploy via `wrangler pages deploy`)
- [ ] Verify production health check: `curl https://<production-url>/health`

## Post-Deployment
- [ ] Monitor logs for 1 hour
- [ ] Check extraction success rates
- [ ] Check error rate and latency
- [ ] Confirm no major scraper regressions
- [ ] Verify haul endpoints: `POST /ext/v1/hauls` returns a valid haul ID

## Rollback
If issues are detected:
1. Revert to previous deployment (Cloudflare Pages > Deployments > rollback to previous).
2. Verify service health.
3. Investigate root cause in staging.
4. Ship fix and redeploy.
