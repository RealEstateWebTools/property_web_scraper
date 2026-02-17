/**
 * ai-map-service.ts — AI-assisted scraper mapping generation.
 *
 * Analyzes HTML structure and uses an LLM to suggest CSS selectors
 * and JSON paths for building a ScraperMapping.
 */

import type { ScraperMapping, FieldMapping } from '../extractor/mapping-loader.js';

// ─── Types ───────────────────────────────────────────────────────

export type LLMProvider = 'gemini' | 'openai';

export interface HtmlAnalysis {
  htmlLength: number;
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  jsonLdSample?: string;
  scriptVars: string[];
  scriptVarSamples: Record<string, string>;
  metaTags: Record<string, string>;
  headingTexts: string[];
  detectedSource: 'json-ld' | 'script-json' | 'html' | 'mixed';
}

export interface MappingSuggestion {
  mapping: ScraperMapping;
  confidence: number;
  notes: string[];
  detectedSource: string;
}

// ─── HTML Analysis ───────────────────────────────────────────────

const KNOWN_SCRIPT_VARS = [
  'PAGE_MODEL', '__NEXT_DATA__', '__INITIAL_STATE__', 'dataLayer',
  '__NUXT__', 'window.__DATA__', '__PRELOADED_STATE__',
  'ssrData', 'pageProps', 'window.classified',
];

/**
 * Analyze HTML to detect content sources, script variables, and structure.
 */
export function analyzeHtmlStructure(html: string): HtmlAnalysis {
  const analysis: HtmlAnalysis = {
    htmlLength: html.length,
    hasJsonLd: false,
    jsonLdTypes: [],
    scriptVars: [],
    scriptVarSamples: {},
    metaTags: {},
    headingTexts: [],
    detectedSource: 'html',
  };

  // Detect JSON-LD
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches && jsonLdMatches.length > 0) {
    analysis.hasJsonLd = true;
    for (const match of jsonLdMatches) {
      const content = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim();
      try {
        const parsed = JSON.parse(content);
        const type = parsed['@type'] || (Array.isArray(parsed['@graph']) ? parsed['@graph'].map((g: any) => g['@type']).join(', ') : 'unknown');
        analysis.jsonLdTypes.push(type);
        if (!analysis.jsonLdSample) {
          analysis.jsonLdSample = content.slice(0, 2000);
        }
      } catch { /* malformed JSON-LD */ }
    }
  }

  // Detect script variables
  for (const varName of KNOWN_SCRIPT_VARS) {
    // Match: var X = {...}, window.X = {...}, or X = {...}
    const patterns = [
      new RegExp(`(?:var\\s+|window\\.)${varName.replace('window.', '')}\\s*=\\s*([{\\[])`, 'i'),
      new RegExp(`"${varName}"\\s*:\\s*([{\\[])`, 'i'),
    ];
    for (const pattern of patterns) {
      if (pattern.test(html)) {
        const cleanName = varName.replace('window.', '');
        analysis.scriptVars.push(cleanName);

        // Try to extract a sample of the variable content
        const fullMatch = html.match(
          new RegExp(`(?:var\\s+|window\\.)?${cleanName.replace('window.', '')}\\s*=\\s*([\\s\\S]{1,3000})`, 'i')
        );
        if (fullMatch) {
          analysis.scriptVarSamples[cleanName] = fullMatch[1].slice(0, 2000);
        }
        break;
      }
    }
  }

  // Extract meta tags
  const metaRegex = /<meta\s+(?:[^>]*?(?:name|property)=["']([^"']+)["'][^>]*?content=["']([^"']*?)["']|[^>]*?content=["']([^"']*?)["'][^>]*?(?:name|property)=["']([^"']+)["'])[^>]*\/?>/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const name = metaMatch[1] || metaMatch[4];
    const content = metaMatch[2] || metaMatch[3];
    if (name && content) {
      analysis.metaTags[name] = content.slice(0, 200);
    }
  }

  // Extract heading texts
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    const text = headingMatch[1].replace(/<[^>]+>/g, '').trim();
    if (text) analysis.headingTexts.push(text.slice(0, 100));
    if (analysis.headingTexts.length >= 5) break;
  }

  // Determine primary source
  if (analysis.scriptVars.length > 0 && analysis.hasJsonLd) {
    analysis.detectedSource = 'mixed';
  } else if (analysis.scriptVars.length > 0) {
    analysis.detectedSource = 'script-json';
  } else if (analysis.hasJsonLd) {
    analysis.detectedSource = 'json-ld';
  } else {
    analysis.detectedSource = 'html';
  }

  return analysis;
}

// ─── Prompt Construction ─────────────────────────────────────────

const TARGET_FIELDS = {
  textFields: [
    'title', 'description', 'price_string', 'reference',
    'address_string', 'street_address', 'street_name', 'street_number',
    'postal_code', 'city', 'province', 'region', 'country',
    'main_image_url', 'property_type', 'tenure',
  ],
  intFields: [
    'count_bedrooms', 'count_bathrooms', 'count_toilets',
    'count_garages', 'year_construction',
  ],
  floatFields: [
    'price_float', 'latitude', 'longitude',
    'constructed_area', 'plot_area',
  ],
  booleanFields: [
    'for_sale', 'for_rent', 'for_rent_long_term', 'for_rent_short_term',
    'furnished', 'sold',
  ],
};

const EXAMPLE_MAPPING = `{
  "name": "example_portal",
  "expectedExtractionRate": 0.7,
  "defaultValues": {
    "country": { "value": "UK" },
    "currency": { "value": "GBP" },
    "locale_code": { "value": "en" }
  },
  "textFields": {
    "title": { "cssLocator": "h1.listing-title" },
    "description": { "cssLocator": "div.description p" },
    "price_string": { "scriptJsonVar": "PAGE_MODEL", "scriptJsonPath": "listing.price.display" },
    "address_string": { "jsonLdPath": "address.streetAddress", "jsonLdType": "Residence" }
  },
  "intFields": {
    "count_bedrooms": { "scriptJsonVar": "PAGE_MODEL", "scriptJsonPath": "listing.bedrooms" }
  },
  "floatFields": {
    "price_float": { "scriptJsonVar": "PAGE_MODEL", "scriptJsonPath": "listing.price.amount" },
    "latitude": { "jsonLdPath": "geo.latitude", "jsonLdType": "Residence" }
  },
  "booleanFields": {
    "for_sale": { "scriptJsonVar": "PAGE_MODEL", "scriptJsonPath": "listing.channel", "evaluator": "include?", "evaluatorParam": "sale" }
  },
  "images": [
    { "scriptJsonVar": "PAGE_MODEL", "scriptJsonPath": "listing.images", "cssAttr": "url" }
  ],
  "features": [
    { "cssLocator": "ul.features li" }
  ]
}`;

export function buildMappingPrompt(analysis: HtmlAnalysis, sourceUrl: string): string {
  let prompt = `You are an expert web scraper. Analyze this real estate listing page and generate a JSON scraper mapping.

## Target Output Format
Generate a JSON object matching this schema (example):
${EXAMPLE_MAPPING}

## Available Extraction Strategies
Each field mapping can use ONE of these strategies:
- \`cssLocator\`: CSS selector to find the element (text content extracted)
- \`cssLocator\` + \`cssAttr\`: CSS selector + attribute name (e.g., "content", "href", "src")
- \`scriptJsonVar\` + \`scriptJsonPath\`: JavaScript variable name + dot-path into that object
- \`jsonLdPath\` + \`jsonLdType\`: Path into JSON-LD data, optionally filtered by @type
- \`value\`: Static default value (for country, currency, locale)

Optional additions:
- \`fallbacks\`: Array of alternative strategies if primary fails
- \`evaluator\`: "include?" with \`evaluatorParam\` for boolean text matching

## Fields To Map
- textFields: ${TARGET_FIELDS.textFields.join(', ')}
- intFields: ${TARGET_FIELDS.intFields.join(', ')}
- floatFields: ${TARGET_FIELDS.floatFields.join(', ')}
- booleanFields: ${TARGET_FIELDS.booleanFields.join(', ')}
- images: array of image URL extraction configs
- features: array of feature list extraction configs

## Source URL
${sourceUrl}

## Detected Content Sources
`;

  if (analysis.hasJsonLd) {
    prompt += `\n### JSON-LD (types: ${analysis.jsonLdTypes.join(', ')})\n\`\`\`json\n${analysis.jsonLdSample || 'N/A'}\n\`\`\`\n`;
  }

  if (analysis.scriptVars.length > 0) {
    prompt += `\n### Script Variables Found: ${analysis.scriptVars.join(', ')}\n`;
    for (const [varName, sample] of Object.entries(analysis.scriptVarSamples)) {
      prompt += `\n#### ${varName} (sample):\n\`\`\`\n${sample}\n\`\`\`\n`;
    }
  }

  if (Object.keys(analysis.metaTags).length > 0) {
    prompt += `\n### Meta Tags\n`;
    const relevant = ['og:title', 'og:description', 'og:image', 'og:url', 'description', 'geo.position'];
    for (const tag of relevant) {
      if (analysis.metaTags[tag]) {
        prompt += `- ${tag}: "${analysis.metaTags[tag]}"\n`;
      }
    }
  }

  if (analysis.headingTexts.length > 0) {
    prompt += `\n### Page Headings\n${analysis.headingTexts.map(h => `- ${h}`).join('\n')}\n`;
  }

  prompt += `
## Instructions
1. Prefer scriptJsonVar/scriptJsonPath if a suitable script variable is detected — it's most reliable.
2. Use jsonLdPath if JSON-LD contains the data.
3. Fall back to cssLocator for fields not in structured data.
4. Add fallbacks for critical fields (title, price_string, description).
5. Set appropriate defaultValues for country, currency, area_unit, locale_code based on the URL/content.
6. Set expectedExtractionRate to your confidence level (0.0-1.0).
7. Only include fields you can map — skip fields with no clear source.

## Response Format
Return ONLY the JSON mapping object. No markdown, no explanation. Just valid JSON.`;

  return prompt;
}

// ─── LLM API Calls ───────────────────────────────────────────────

interface LLMCallOptions {
  prompt: string;
  provider: LLMProvider;
  apiKey: string;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a web scraping expert. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function callLLM({ prompt, provider, apiKey }: LLMCallOptions): Promise<string> {
  if (provider === 'gemini') {
    return callGemini(prompt, apiKey);
  }
  return callOpenAI(prompt, apiKey);
}

// ─── Response Parsing ────────────────────────────────────────────

/**
 * Parse and validate the LLM's JSON response into a ScraperMapping.
 */
export function parseMappingResponse(
  raw: string,
  scraperName: string,
): MappingSuggestion {
  const notes: string[] = [];

  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`LLM returned invalid JSON: ${(e as Error).message}\n\nRaw output:\n${raw.slice(0, 500)}`);
  }

  // Handle array wrapper (some mappings use [{...}])
  if (Array.isArray(parsed)) {
    parsed = parsed[0];
  }

  // Ensure name
  parsed.name = scraperName;

  // Validate structure
  const mapping: ScraperMapping = {
    name: parsed.name,
    ...(parsed.expectedExtractionRate && { expectedExtractionRate: parsed.expectedExtractionRate }),
    ...(parsed.defaultValues && { defaultValues: parsed.defaultValues }),
    ...(parsed.textFields && { textFields: parsed.textFields }),
    ...(parsed.intFields && { intFields: parsed.intFields }),
    ...(parsed.floatFields && { floatFields: parsed.floatFields }),
    ...(parsed.booleanFields && { booleanFields: parsed.booleanFields }),
    ...(parsed.images && { images: parsed.images }),
    ...(parsed.features && { features: parsed.features }),
    ...(parsed.extraFields && { extraFields: parsed.extraFields }),
    ...(parsed.portal && { portal: parsed.portal }),
  };

  // Count mapped fields
  let fieldCount = 0;
  for (const section of ['textFields', 'intFields', 'floatFields', 'booleanFields'] as const) {
    if (mapping[section]) fieldCount += Object.keys(mapping[section]!).length;
  }

  if (fieldCount === 0) {
    notes.push('⚠️ No fields were mapped. The HTML may not contain extractable property data.');
  } else {
    notes.push(`✅ Mapped ${fieldCount} fields`);
  }

  if (mapping.images && mapping.images.length > 0) {
    notes.push('✅ Image extraction configured');
  } else {
    notes.push('⚠️ No image extraction configured');
  }

  if (mapping.features && mapping.features.length > 0) {
    notes.push('✅ Feature extraction configured');
  }

  // Estimate confidence
  const totalPossible = TARGET_FIELDS.textFields.length + TARGET_FIELDS.intFields.length +
    TARGET_FIELDS.floatFields.length + TARGET_FIELDS.booleanFields.length;
  const confidence = Math.min(1, fieldCount / (totalPossible * 0.6)); // 60% coverage = 100% confidence

  return {
    mapping,
    confidence: Math.round(confidence * 100) / 100,
    notes,
    detectedSource: parsed.portal?.contentSource || 'unknown',
  };
}

// ─── Main Entry Point ────────────────────────────────────────────

export interface GenerateMappingOptions {
  html: string;
  sourceUrl: string;
  scraperName: string;
  provider?: LLMProvider;
  apiKey?: string;
}

export async function generateMapping(options: GenerateMappingOptions): Promise<MappingSuggestion> {
  const provider = options.provider || 'gemini';
  const apiKey = options.apiKey;

  if (!apiKey) {
    throw new Error(`AI_MAP_API_KEY environment variable required for ${provider} provider`);
  }

  const analysis = analyzeHtmlStructure(options.html);
  const prompt = buildMappingPrompt(analysis, options.sourceUrl);
  const rawResponse = await callLLM({ prompt, provider, apiKey });
  const suggestion = parseMappingResponse(rawResponse, options.scraperName);

  suggestion.detectedSource = analysis.detectedSource;

  return suggestion;
}
