/**
 * Cleanup empty or small hauls from Firebase Firestore
 *
 * Identifies and deletes hauls with fewer than a specified number of listings.
 * Hauls are often created during testing or exploration but abandoned with
 * no or very few listings saved.
 *
 * Usage:
 *   node scripts/cleanup-empty-hauls.mjs                    # Preview (min 1 listing)
 *   node scripts/cleanup-empty-hauls.mjs --min-listings 2   # Preview (min 2 listings)
 *   node scripts/cleanup-empty-hauls.mjs --confirm           # Delete (min 1 listing)
 *   node scripts/cleanup-empty-hauls.mjs --min-listings 3 --confirm # Delete (min 3 listings)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');

dotenv.config({ path: envPath });

// Initialize Firebase with credentials from environment
const projectId = process.env.FIRESTORE_PROJECT_ID;
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!projectId) {
  console.error('❌ Error: FIRESTORE_PROJECT_ID not set');
  console.error('Make sure you have .env file with FIRESTORE_PROJECT_ID and GOOGLE_SERVICE_ACCOUNT_JSON');
  process.exit(1);
}

if (!serviceAccountJson) {
  console.error('❌ Error: GOOGLE_SERVICE_ACCOUNT_JSON not set');
  console.error('Make sure you have .env file with Firebase credentials');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (e) {
  console.error('❌ Error: Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId,
});

const db = getFirestore(app);
const prefix = process.env.FIRESTORE_COLLECTION_PREFIX || '';

// Parse command-line arguments
let minListings = 1;
let confirm = false;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--min-listings') {
    minListings = parseInt(process.argv[i + 1], 10);
    i++;
  } else if (process.argv[i] === '--confirm') {
    confirm = true;
  }
}

if (isNaN(minListings) || minListings < 0) {
  console.error('❌ Error: --min-listings must be a non-negative number');
  process.exit(1);
}

async function cleanup() {
  console.log(`Starting empty hauls cleanup (minimum listings: ${minListings})...\n`);

  // Get all hauls
  console.log('📋 Scanning hauls...');
  const haulsRef = db.collection(`${prefix}hauls`);
  const haulsSnapshot = await haulsRef.get();

  const haulsToDelete = [];
  const haulsToKeep = [];
  let expiredCount = 0;

  const now = Date.now();

  for (const doc of haulsSnapshot.docs) {
    const haul = doc.data();
    if (!haul) continue;

    // Count scrapes/listings in the haul
    const scraperCount = (haul.scrapes || []).length;
    const expiresAt = haul.expiresAt ? new Date(haul.expiresAt).getTime() : 0;
    const isExpired = expiresAt > 0 && expiresAt < now;

    // Skip expired hauls (matching admin interface behavior)
    if (isExpired) {
      expiredCount++;
      continue;
    }

    const haulInfo = {
      id: doc.id,
      name: haul.name || '(unnamed)',
      scraperCount,
      createdAt: haul.createdAt || '(unknown)',
      isExpired,
    };

    if (scraperCount < minListings) {
      haulsToDelete.push(haulInfo);
    } else {
      haulsToKeep.push(haulInfo);
    }
  }

  // Summary
  console.log(`\n📊 Haul Analysis:`);
  console.log(`   Total in collection: ${haulsSnapshot.size}`);
  console.log(`   Expired hauls (skipped): ${expiredCount}`);
  console.log(`   Active hauls: ${haulsToDelete.length + haulsToKeep.length}`);
  console.log(`   Hauls to delete: ${haulsToDelete.length}`);
  console.log(`   Hauls to keep: ${haulsToKeep.length}`);

  if (haulsToDelete.length === 0) {
    console.log('\n✅ No hauls found with fewer than ' + minListings + ' listing(s)!');
    process.exit(0);
  }

  // Show samples with details
  console.log(`\n   Sample hauls to delete:`);
  haulsToDelete.slice(0, 5).forEach(h => {
    console.log(`     - ${h.id}: "${h.name}" (${h.scraperCount} listing${h.scraperCount !== 1 ? 's' : ''})${h.isExpired ? ' [EXPIRED]' : ''}`);
  });
  if (haulsToDelete.length > 5) {
    console.log(`     ... and ${haulsToDelete.length - 5} more`);
  }

  // Statistics
  const stats = haulsToDelete.reduce((acc, h) => {
    acc.byCount[h.scraperCount] = (acc.byCount[h.scraperCount] || 0) + 1;
    acc.expiredCount += h.isExpired ? 1 : 0;
    return acc;
  }, { byCount: {}, expiredCount: 0 });

  console.log(`\n   Distribution of hauls to delete:`);
  Object.keys(stats.byCount)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(count => {
      console.log(`     - ${count} listing(s): ${stats.byCount[count]} haul(s)`);
    });

  if (stats.expiredCount > 0) {
    console.log(`   ${stats.expiredCount} of these hauls are also expired`);
  }

  // Confirm deletion
  console.log('\n⚠️  This will DELETE these hauls from Firebase.');
  console.log('   This action cannot be undone.\n');

  if (!confirm) {
    console.log('To execute deletion, run with --confirm flag:');
    console.log(`  node scripts/cleanup-empty-hauls.mjs --min-listings ${minListings} --confirm\n`);
    process.exit(0);
  }

  // Delete hauls
  console.log('\n🗑️  Deleting empty hauls...');
  let deleted = 0;
  for (const haulInfo of haulsToDelete) {
    await haulsRef.doc(haulInfo.id).delete();
    deleted++;
    if (deleted % 10 === 0) {
      console.log(`   Deleted ${deleted}/${haulsToDelete.length} hauls...`);
    }
  }

  console.log('\n✅ Cleanup complete!');
  console.log(`   Deleted ${haulsToDelete.length} haul(s)\n`);

  process.exit(0);
}

cleanup().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
