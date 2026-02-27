/**
 * Delete listings with low extraction quality from Firestore.
 *
 * Filters by grade, extraction rate, or confidence score (or a combination).
 * Always runs as a dry-run preview unless --confirm is passed.
 *
 * Usage:
 *   node scripts/cleanup-low-quality-listings.mjs
 *       # Preview: grade F listings
 *
 *   node scripts/cleanup-low-quality-listings.mjs --grade F
 *       # Preview: grade F only (default)
 *
 *   node scripts/cleanup-low-quality-listings.mjs --grade F,C
 *       # Preview: grade F or C listings
 *
 *   node scripts/cleanup-low-quality-listings.mjs --max-rate 0.1
 *       # Preview: extraction_rate < 10%
 *
 *   node scripts/cleanup-low-quality-listings.mjs --max-confidence 0.2
 *       # Preview: confidence_score < 20%
 *
 *   node scripts/cleanup-low-quality-listings.mjs --grade F --max-rate 0.15
 *       # Preview: grade F AND extraction_rate < 15% (both conditions must match)
 *
 *   node scripts/cleanup-low-quality-listings.mjs --grade F --confirm
 *       # Execute deletion
 *
 *   node scripts/cleanup-low-quality-listings.mjs --grade F,C --confirm
 *       # Execute deletion of grade F and C listings
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const projectId = process.env.FIRESTORE_PROJECT_ID;
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!projectId) {
  console.error('❌ FIRESTORE_PROJECT_ID not set in .env');
  process.exit(1);
}
if (!serviceAccountJson) {
  console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSON not set in .env');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch {
  console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore();
const prefix = process.env.FIRESTORE_COLLECTION_PREFIX || '';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const VALID_GRADES = new Set(['A', 'B', 'C', 'F']);
let grades = ['F'];           // default: delete grade F
let maxRate = null;           // extraction_rate threshold (null = not used)
let maxConfidence = null;     // confidence_score threshold (null = not used)
let confirm = false;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--grade') {
    grades = (process.argv[++i] || '').toUpperCase().split(',').map(g => g.trim());
    for (const g of grades) {
      if (!VALID_GRADES.has(g)) {
        console.error(`❌ Invalid grade "${g}". Valid values: A, B, C, F`);
        process.exit(1);
      }
    }
  } else if (arg === '--max-rate') {
    maxRate = parseFloat(process.argv[++i]);
    if (isNaN(maxRate) || maxRate < 0 || maxRate > 1) {
      console.error('❌ --max-rate must be a number between 0 and 1 (e.g. 0.15 for 15%)');
      process.exit(1);
    }
  } else if (arg === '--max-confidence') {
    maxConfidence = parseFloat(process.argv[++i]);
    if (isNaN(maxConfidence) || maxConfidence < 0 || maxConfidence > 1) {
      console.error('❌ --max-confidence must be a number between 0 and 1 (e.g. 0.2 for 20%)');
      process.exit(1);
    }
  } else if (arg === '--confirm') {
    confirm = true;
  } else if (arg === '--help') {
    console.log('Usage: node scripts/cleanup-low-quality-listings.mjs [options]');
    console.log('');
    console.log('Options:');
    console.log('  --grade <grades>          Comma-separated grades to delete (default: F)');
    console.log('                            e.g. --grade F  or  --grade F,C');
    console.log('  --max-rate <0-1>          Delete if extraction_rate is below this value');
    console.log('                            e.g. --max-rate 0.1  (10%)');
    console.log('  --max-confidence <0-1>    Delete if confidence_score is below this value');
    console.log('                            e.g. --max-confidence 0.2  (20%)');
    console.log('  --confirm                 Execute deletion (default is dry-run preview)');
    console.log('');
    console.log('When multiple filters are given, ALL must match (AND logic).');
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// Filter predicate
// ---------------------------------------------------------------------------
function shouldDelete(data) {
  const gradeMatch = grades.includes((data.quality_grade || '').toUpperCase());
  const rateMatch = maxRate === null || (data.extraction_rate ?? 1) < maxRate;
  const confidenceMatch = maxConfidence === null || (data.confidence_score ?? 1) < maxConfidence;
  return gradeMatch && rateMatch && confidenceMatch;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  // Describe what we're looking for
  const filters = [`grade: ${grades.join(' or ')}`];
  if (maxRate !== null) filters.push(`extraction_rate < ${(maxRate * 100).toFixed(0)}%`);
  if (maxConfidence !== null) filters.push(`confidence_score < ${(maxConfidence * 100).toFixed(0)}%`);
  console.log(`\n🔍 Filter: ${filters.join('  AND  ')}`);
  console.log(`   Mode:   ${confirm ? '⚠️  DELETE (confirmed)' : '👀 Preview (dry run)'}\n`);

  console.log('📋 Scanning listings...');
  const snapshot = await db.collection(`${prefix}listings`).get();
  console.log(`   Found ${snapshot.size} total listings\n`);

  const toDelete = [];
  const byGrade = {};
  const byVisibility = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data) continue;
    if (!shouldDelete(data)) continue;

    const grade = (data.quality_grade || '?').toUpperCase();
    const vis = data.visibility || 'unknown';
    byGrade[grade] = (byGrade[grade] || 0) + 1;
    byVisibility[vis] = (byVisibility[vis] || 0) + 1;

    toDelete.push({
      id: doc.id,
      grade,
      rate: data.extraction_rate ?? 0,
      confidence: data.confidence_score ?? 0,
      scraper: data.scraper_name || '(unknown)',
      url: data.import_url || '(no url)',
      title: data.title || '(no title)',
    });
  }

  // Summary
  console.log(`📊 Results:`);
  console.log(`   Listings to delete: ${toDelete.length}`);
  console.log(`   Listings to keep:   ${snapshot.size - toDelete.length}`);

  if (toDelete.length === 0) {
    console.log('\n✅ No listings match the filter criteria. Nothing to delete.\n');
    process.exit(0);
  }

  console.log(`\n   By grade:`);
  for (const [g, count] of Object.entries(byGrade).sort()) {
    console.log(`     ${g}: ${count}`);
  }

  console.log(`\n   By visibility:`);
  for (const [v, count] of Object.entries(byVisibility).sort()) {
    console.log(`     ${v}: ${count}`);
  }

  console.log(`\n   Sample listings to delete:`);
  toDelete.slice(0, 8).forEach(l => {
    const rate = `${(l.rate * 100).toFixed(0)}%`;
    const conf = `${(l.confidence * 100).toFixed(0)}%`;
    console.log(`     [${l.grade}] rate:${rate} conf:${conf}  ${l.scraper}  ${l.url.substring(0, 60)}`);
  });
  if (toDelete.length > 8) {
    console.log(`     ... and ${toDelete.length - 8} more`);
  }

  console.log('\n⚠️  This will permanently DELETE these listings from Firestore.');

  if (!confirm) {
    const cmd = `node scripts/cleanup-low-quality-listings.mjs --grade ${grades.join(',')}` +
      (maxRate !== null ? ` --max-rate ${maxRate}` : '') +
      (maxConfidence !== null ? ` --max-confidence ${maxConfidence}` : '') +
      ` --confirm`;
    console.log(`\nTo execute, run:\n  ${cmd}\n`);
    process.exit(0);
  }

  // Delete in batches of 500 (Firestore limit)
  console.log(`\n🗑️  Deleting ${toDelete.length} listings...`);
  const BATCH_SIZE = 500;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const item of toDelete.slice(i, i + BATCH_SIZE)) {
      batch.delete(db.collection(`${prefix}listings`).doc(item.id));
    }
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, toDelete.length - i);
    console.log(`   Deleted ${deleted}/${toDelete.length}...`);
  }

  console.log(`\n✅ Done. Deleted ${toDelete.length} low-quality listing(s).\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Script failed:', err.message || err);
  process.exit(1);
});
