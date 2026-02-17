# Deployment Checklist

## Pre-Deployment
- [ ] Run unit tests: `npm run test`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Verify TypeScript: `npx tsc --noEmit`
- [ ] Confirm required environment variables are configured
- [ ] Confirm API keys and admin keys are valid

## Deployment
- [ ] Build application: `npm run build`
- [ ] Deploy to staging first
- [ ] Verify health check: `curl https://staging.example.com/health`
- [ ] Test key API endpoints in staging
- [ ] Deploy to production
- [ ] Verify production health check: `curl https://example.com/health`

## Post-Deployment
- [ ] Monitor logs for 1 hour
- [ ] Check extraction success rates
- [ ] Check error rate and latency
- [ ] Confirm no major scraper regressions

## Rollback
If issues are detected:
1. Revert to previous deployment.
2. Verify service health.
3. Investigate root cause in staging.
4. Ship fix and redeploy.
