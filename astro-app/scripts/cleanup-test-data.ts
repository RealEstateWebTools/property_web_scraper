/**
 * Cleanup test data from Firebase Firestore
 *
 * Identifies and deletes listings and hauls that appear to be test data.
 *
 * Test data patterns:
 * - Hauls with names like "My London Search", "Test Haul", etc.
 * - Listings with test URLs (localhost, example.com, test, demo, etc.)
 * - Very recent listings (within last hour) that haven't been updated
 *
 * Usage:
 *   npx ts-node scripts/cleanup-test-data.ts          # Preview what will be deleted
 *   npx ts-node scripts/cleanup-test-data.ts --confirm # Actually delete
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase (uses GOOGLE_APPLICATION_CREDENTIALS env var)
const app = initializeApp({
  projectId: process.env.FIRESTORE_PROJECT_ID,
});

const db = getFirestore(app);

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

async function isTestListing(doc: any): Promise<boolean> {
  const data = doc.data();
  if (!data) return false;

  const url = (data.import_url || '').toLowerCase();

  // Check for test URL patterns
  for (const pattern of testPatterns.listing_urls) {
    if (url.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check for very recent empty listings (likely test data)
  const created = data.created_at ? new Date(data.created_at).getTime() : 0;
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Very recent (< 1 hour) and missing key fields = likely test data
  if (created > oneHourAgo && !data.title) {
    return true;
  }

  return false;
}

async function isTestHaul(doc: any): Promise<boolean> {
  const data = doc.data();
  if (!data) return false;

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
  const listingsRef = db.collection('listings');
  const listingsSnapshot = await listingsRef.get();

  let listingsToDelete: string[] = [];
  for (const doc of listingsSnapshot.docs) {
    if (await isTestListing(doc)) {
      listingsToDelete.push(doc.id);
    }
  }

  // Clean up hauls
  console.log('📋 Scanning hauls...');
  const haulsRef = db.collection('hauls');
  const haulsSnapshot = await haulsRef.get();

  let haulsToDelete: string[] = [];
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
    console.log('  npx ts-node scripts/cleanup-test-data.ts --confirm\n');
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
