#!/usr/bin/env npx tsx
/**
 * capture-browser-fixtures.ts — Batch capture browser-rendered HTML fixtures
 * using Puppeteer. Navigates to each listing URL, waits for JS rendering,
 * and saves the full rendered DOM as an HTML fixture.
 *
 * Also captures server-fetched versions via plain HTTP fetch for comparison.
 *
 * Usage:
 *   npx tsx scripts/capture-browser-fixtures.ts              # All scrapers
 *   npx tsx scripts/capture-browser-fixtures.ts uk_rightmove  # Single scraper
 *   npx tsx scripts/capture-browser-fixtures.ts --server-only # Only server-fetched
 */

// @ts-expect-error puppeteer is an optional dev dependency for this script only
import puppeteer from 'puppeteer';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '..', 'test', 'fixtures');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─── Listing URLs ──────────────────────────────────────────────
// Each entry: [scraperName, fixtureName, listingUrl]
const LISTINGS: Array<[string, string, string]> = [
  // UK
  ['uk_rightmove', 'uk_rightmove', 'https://www.rightmove.co.uk/properties/171844895'],
  ['uk_zoopla', 'uk_zoopla', 'https://www.zoopla.co.uk/for-sale/details/71365505/'],
  ['uk_onthemarket', 'uk_onthemarket', 'https://www.onthemarket.com/details/16979647/'],
  ['uk_jitty', 'uk_jitty', 'https://jitty.com/properties/rtI0BPlsWvEohngvc7HB'],

  // Ireland
  ['ie_daft', 'ie_daft', 'https://www.daft.ie/for-sale/detached-house-12-the-avenue-plunkett-hall-dunboyne-co-meath/6477069'],

  // Spain
  ['es_idealista', 'es_idealista', 'https://www.idealista.com/en/inmueble/106387165/'],
  ['es_fotocasa', 'es_fotocasa', 'https://www.fotocasa.es/es/comprar/vivienda/benavente/trastero-ascensor/185235713/d'],
  ['es_pisos', 'es_pisos', 'https://www.pisos.com/comprar/piso-benavente/'],

  // US
  ['us_realtor', 'us_realtor', 'https://www.realtor.com/realestateandhomes-detail/5804-Cedar-Glen-Ln_Bakersfield_CA_93313_M12147-18296'],
  ['us_mlslistings', 'us_mlslistings', 'https://www.mlslistings.com/property/ml81643266/1547-Desdemona-CT-SAN-JOSE-CA-95121'],
  ['us_wyomingmls', 'us_wyomingmls', 'https://www.wyomingmls.com/listing/20176813'],
  ['us_forsalebyowner', 'us_forsalebyowner', 'https://www.forsalebyowner.com/listing/12345'],

  // India
  ['in_realestateindia', 'in_realestateindia', 'https://www.realestateindia.com/property-detail/3bkh-individual-houses-villas-for-rent-in-heritage-town-pondicherry-1800-sq-ft-27-000-1131690.htm'],

  // Germany
  ['de_immoscout', 'de_immoscout', 'https://www.immobilienscout24.de/expose/165659590'],

  // France
  ['fr_seloger', 'fr_seloger', 'https://www.seloger.com/annonces/achat/appartement/paris-7eme-75/259857645.htm'],
  ['fr_leboncoin', 'fr_leboncoin', 'https://www.leboncoin.fr/ad/ventes_immobilieres/3102765694'],

  // Australia
  ['au_domain', 'au_domain', 'https://www.domain.com.au/13-paringa-road-murarrie-qld-4172-2020257530'],
  ['au_realestate', 'au_realestate', 'https://www.realestate.com.au/property-house-vic-richmond-147714569'],
];

// ─── Server-fetched capture ────────────────────────────────────

async function captureServerFetched(name: string, url: string): Promise<{ ok: boolean; bytes: number; httpCode: number }> {
  const outPath = resolve(FIXTURES_DIR, `${name}.server-fetched.html`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    writeFileSync(outPath, html, 'utf-8');
    return { ok: res.ok, bytes: html.length, httpCode: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeFileSync(outPath, `<!-- Fetch failed: ${msg} -->`, 'utf-8');
    return { ok: false, bytes: 0, httpCode: 0 };
  }
}

// ─── Browser capture ───────────────────────────────────────────

async function captureBrowser(
  browser: puppeteer.Browser,
  name: string,
  url: string
): Promise<{ ok: boolean; bytes: number; title: string }> {
  const outPath = resolve(FIXTURES_DIR, `${name}.html`);
  const page = await browser.newPage();

  try {
    await page.setUserAgent(UA);
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate with 30s timeout
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 }).catch(() => {
      // Fallback: just wait for DOM content
      return page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    });

    // Extra wait for JS-heavy sites
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const title = await page.title();
    const html = await page.content();

    writeFileSync(outPath, html, 'utf-8');
    return { ok: true, bytes: html.length, title };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ Browser capture failed for ${name}: ${msg}`);
    return { ok: false, bytes: 0, title: '' };
  } finally {
    await page.close();
  }
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const serverOnly = args.includes('--server-only');
  const filterScraper = args.find(a => !a.startsWith('-'));

  const entries = filterScraper
    ? LISTINGS.filter(([s]) => s === filterScraper)
    : LISTINGS;

  if (entries.length === 0) {
    console.error(`Scraper not found: ${filterScraper}`);
    console.error(`Available: ${LISTINGS.map(([s]) => s).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n📸 Capturing fixtures for ${entries.length} scraper(s)...\n`);

  // Browser captures
  let browser: puppeteer.Browser | null = null;
  if (!serverOnly) {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  const results: Array<{
    scraper: string;
    browserOk: boolean;
    browserBytes: number;
    browserTitle: string;
    serverOk: boolean;
    serverBytes: number;
    serverCode: number;
  }> = [];

  for (const [scraper, fixture, url] of entries) {
    console.log(`\n── ${scraper} ──`);
    console.log(`   URL: ${url}`);

    // Browser capture
    let browserResult = { ok: false, bytes: 0, title: '' };
    if (browser) {
      console.log('   🌐 Browser capture...');
      browserResult = await captureBrowser(browser, fixture, url);
      if (browserResult.ok) {
        console.log(`   ✅ Browser: ${(browserResult.bytes / 1024).toFixed(0)}KB — "${browserResult.title}"`);
      }
    }

    // Server-fetched capture
    console.log('   📡 Server-fetched capture...');
    const serverResult = await captureServerFetched(fixture, url);
    const emoji = serverResult.ok ? '✅' : '🚫';
    console.log(`   ${emoji} Server: HTTP ${serverResult.httpCode}, ${(serverResult.bytes / 1024).toFixed(0)}KB`);

    results.push({
      scraper,
      browserOk: browserResult.ok,
      browserBytes: browserResult.bytes,
      browserTitle: browserResult.title,
      serverOk: serverResult.ok,
      serverBytes: serverResult.bytes,
      serverCode: serverResult.httpCode,
    });
  }

  if (browser) await browser.close();

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('  CAPTURE SUMMARY');
  console.log('═'.repeat(80));
  console.log(`  ${'Scraper'.padEnd(22)} ${'Browser'.padEnd(12)} ${'Server'.padEnd(15)} Title`);
  console.log('─'.repeat(80));

  for (const r of results) {
    const bStatus = r.browserOk ? `${(r.browserBytes/1024).toFixed(0)}KB` : 'FAILED';
    const sStatus = r.serverOk ? `${r.serverCode} ${(r.serverBytes/1024).toFixed(0)}KB` : `${r.serverCode} blocked`;
    console.log(`  ${r.scraper.padEnd(22)} ${bStatus.padEnd(12)} ${sStatus.padEnd(15)} ${r.browserTitle.slice(0, 40)}`);
  }

  const browserOk = results.filter(r => r.browserOk).length;
  const serverOk = results.filter(r => r.serverOk).length;
  console.log('─'.repeat(80));
  console.log(`  Browser: ${browserOk}/${results.length} | Server: ${serverOk}/${results.length}`);
}

main().catch(err => {
  console.error(`Fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
