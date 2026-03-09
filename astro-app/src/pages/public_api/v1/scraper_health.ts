import type { APIRoute } from 'astro';
import { apiGuard } from '@lib/services/api-guard.js';
import { buildScraperHealthReport } from '@lib/services/scraper-health-report.js';
import { successResponse, corsPreflightResponse } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const guard = await apiGuard(request);
  if (!guard.ok) return guard.response;

  const report = await buildScraperHealthReport();

  logActivity({
    level: 'info',
    category: 'api_request',
    message: `GET scraper_health: ${report.results.length} scrapers`,
    method: 'GET',
    path: '/public_api/v1/scraper_health',
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return successResponse({
    generated_at: report.timestamp,
    fixture_runtime: report.fixtureRuntime,
    fixture_runtime_warning: report.fixtureRuntimeWarning ?? null,
    summary: {
      total_scrapers: report.summary.totalScrapers,
      with_fixtures: report.summary.withFixtures,
      without_fixtures: report.summary.withoutFixtures,
      fixture_coverage_rate: report.summary.fixtureCoverageRate,
      grade_counts: report.summary.gradeCounts,
      tier_counts: {
        core: report.summary.tierCounts.core,
        experimental: report.summary.tierCounts.experimental,
        manual_only: report.summary.tierCounts.manualOnly,
      },
      meets_expectation_count: report.summary.meetsExpectationCount,
      below_expectation_count: report.summary.belowExpectationCount,
    },
    results: report.results.map((result) => ({
      scraper: result.name,
      country: result.country,
      has_fixture: result.hasFixture,
      support_tier: result.supportTier,
      expected_extraction_rate: result.expectedExtractionRate,
      meets_expectation: result.meetsExpectation,
      consecutive_below_threshold: result.consecutiveBelowThreshold,
      quality_grade: result.grade,
      quality_label: result.label,
      extraction_rate: result.extractionRate,
      weighted_rate: result.weightedRate,
      populated_fields: result.populatedFields,
      total_fields: result.totalFields,
      critical_fields_missing: result.criticalFieldsMissing,
      empty_fields: result.emptyFields,
      error: result.error,
    })),
  }, request);
};