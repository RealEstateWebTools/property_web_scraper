/**
 * POST /admin/api/ai-map
 *
 * Admin-only endpoint for AI-assisted scraper mapping generation.
 * Accepts HTML + sourceUrl, calls LLM to generate a draft ScraperMapping.
 */

import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import {
  analyzeHtmlStructure,
  generateMapping,
  type LLMProvider,
} from '@lib/services/ai-map-service.js';

export const POST: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { html?: string; sourceUrl?: string; scraperName?: string; provider?: string; analyzeOnly?: boolean };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { html, sourceUrl, scraperName, provider, analyzeOnly } = body;

  if (!html) {
    return new Response(JSON.stringify({ error: 'Missing required field: html' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Analysis-only mode: return HTML structure analysis without calling LLM
  if (analyzeOnly) {
    const analysis = analyzeHtmlStructure(html);
    return new Response(JSON.stringify({ analysis }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!sourceUrl || !scraperName) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: sourceUrl, scraperName' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Resolve API key from environment
  const llmProvider = (provider as LLMProvider) || 'gemini';
  const envKey = llmProvider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  const apiKey = import.meta.env[envKey] || process.env[envKey];

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: `No API key configured. Set ${envKey} environment variable.`,
        hint: `Add ${envKey}=your-key to your .env file`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const suggestion = await generateMapping({
      html,
      sourceUrl,
      scraperName,
      provider: llmProvider,
      apiKey,
    });

    return new Response(JSON.stringify(suggestion), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'LLM call failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
