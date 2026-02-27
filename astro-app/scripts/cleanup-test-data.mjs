/**
 * Cleanup test data from Firebase Firestore
 *
 * Identifies and deletes listings and hauls that appear to be test data.
 *
 * Usage:
 *   node scripts/cleanup-test-data.mjs          # Preview what will be deleted
 *   node scripts/cleanup-test-data.mjs --confirm # Actually delete
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

// Test data patterns to identify for deletion
const testPatterns = {
  haul_names: [
    'My London Search',
    'Test Search',
    'Demo Haul',
    'Test Haul',
    'Search',
    'untitled',
  ],
  listing_urls: [
    'localhost',
    'example.com',
    'test.',
    'demo.',
    '127.0.0.1',
    'staging',
  ],
};

async function isTestListing(doc) {
  const data = doc.data();
  const docId = doc.id;
  if (!data) return false;

  // Explicit environment tag — always wins
  const env = data.env;
  if (env === 'development' || env === 'test') return true;

  // Check for auto-generated IDs (these are created during tests)
  if (docId.startsWith('auto_')) {
    return true;
  }

  const url = (data.import_url || '').toLowerCase();

  // Check for test URL patterns
  for (const pattern of testPatterns.listing_urls) {
    if (url.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check for very recent listings (likely test data)
  const created = data.created_at ? new Date(data.created_at).getTime() : 0;
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Very recent (< 1 hour) and missing key fields = likely test data
  if (created > oneHourAgo && !data.title) {
    return true;
  }

  // Recent listings (< 24 hours) with test-like characteristics
  if (created > oneDayAgo) {
    // Check for suspicious patterns in recent listings
    const title = (data.title || '').toLowerCase();
    const description = (data.description || '').toLowerCase();
    const combined = title + ' ' + description;

    const suspiciousPatterns = [
      'test',
      'demo',
      'sample',
      'temporary',
      'temp ',
      'xxx',
      'zzz',
      'placeholder',
    ];

    for (const pattern of suspiciousPatterns) {
      if (combined.includes(pattern)) {
        return true;
      }
    }

    // Recent listings with very low extraction rates might be tests
    if (data.extraction_rate !== undefined && data.extraction_rate < 0.1) {
      return true;
    }
  }

  return false;
}

async function isTestHaul(doc) {
  const data = doc.data();
  if (!data) return false;

  // Explicit environment tag — always wins
  const env = data.env;
  if (env === 'development' || env === 'test') return true;

  const name = (data.name || '').toLowerCase();

  for (const pattern of testPatterns.haul_names) {
    if (name.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  return false;
}

async function cleanup() {
  console.log('Starting test data cleanup...\n');

  // Clean up listings
  console.log('📋 Scanning listings...');
  const listingsRef = db.collection(`${prefix}listings`);
  const listingsSnapshot = await listingsRef.get();

  let listingsToDelete = [];
  for (const doc of listingsSnapshot.docs) {
    if (await isTestListing(doc)) {
      listingsToDelete.push(doc.id);
    }
  }

  // Clean up hauls
  console.log('📋 Scanning hauls...');
  const haulsRef = db.collection(`${prefix}hauls`);
  const haulsSnapshot = await haulsRef.get();

  let haulsToDelete = [];
  for (const doc of haulsSnapshot.docs) {
    if (await isTestHaul(doc)) {
      haulsToDelete.push(doc.id);
    }
  }

  // Summary
  console.log(`\n📊 Test Data Found:`);
  console.log(`   Listings to delete: ${listingsToDelete.length}`);
  console.log(`   Hauls to delete: ${haulsToDelete.length}`);

  if (listingsToDelete.length === 0 && haulsToDelete.length === 0) {
    console.log('\n✅ No test data found!');
    process.exit(0);
  }

  // Show samples
  if (listingsToDelete.length > 0) {
    console.log(`\n   Sample listing IDs to delete:`);
    listingsToDelete.slice(0, 5).forEach(id => console.log(`     - ${id}`));
    if (listingsToDelete.length > 5) {
      console.log(`     ... and ${listingsToDelete.length - 5} more`);
    }
  }

  if (haulsToDelete.length > 0) {
    console.log(`\n   Sample haul IDs to delete:`);
    haulsToDelete.slice(0, 5).forEach(id => console.log(`     - ${id}`));
    if (haulsToDelete.length > 5) {
      console.log(`     ... and ${haulsToDelete.length - 5} more`);
    }
  }

  // Confirm deletion
  console.log('\n⚠️  This will DELETE these records from Firebase.');
  console.log('   This action cannot be undone.\n');

  const confirm = process.argv[2] === '--confirm';
  if (!confirm) {
    console.log('To execute deletion, run with --confirm flag:');
    console.log('  node scripts/cleanup-test-data.mjs --confirm\n');
    process.exit(0);
  }

  // Delete listings
  console.log('\n🗑️  Deleting test listings...');
  let deleted = 0;
  for (const id of listingsToDelete) {
    await listingsRef.doc(id).delete();
    deleted++;
    if (deleted % 10 === 0) {
      console.log(`   Deleted ${deleted}/${listingsToDelete.length} listings...`);
    }
  }

  // Delete hauls
  console.log('\n🗑️  Deleting test hauls...');
  deleted = 0;
  for (const id of haulsToDelete) {
    await haulsRef.doc(id).delete();
    deleted++;
    if (deleted % 10 === 0) {
      console.log(`   Deleted ${deleted}/${haulsToDelete.length} hauls...`);
    }
  }

  console.log('\n✅ Cleanup complete!');
  console.log(`   Deleted ${listingsToDelete.length} listings`);
  console.log(`   Deleted ${haulsToDelete.length} hauls\n`);

  process.exit(0);
}

cleanup().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
