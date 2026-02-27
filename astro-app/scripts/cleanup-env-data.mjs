/**
 * Cleanup data tagged with a specific environment from Firebase Firestore.
 *
 * Queries by the 'env' field directly — no full collection scan heuristics.
 * Works for both listings and hauls collections.
 *
 * Usage:
 *   node scripts/cleanup-env-data.mjs                     # Preview dev + test (both collections)
 *   node scripts/cleanup-env-data.mjs --env development   # Preview only 'development'
 *   node scripts/cleanup-env-data.mjs --env test          # Preview only 'test'
 *   node scripts/cleanup-env-data.mjs --confirm           # Execute deletion
 *   node scripts/cleanup-env-data.mjs --env development --confirm
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
let targetEnv = null; // null = both 'development' and 'test'
let confirm = false;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--env') {
    const val = process.argv[i + 1];
    if (val !== 'development' && val !== 'test') {
      console.error(`❌ Error: --env must be 'development' or 'test', got: ${val}`);
      process.exit(1);
    }
    targetEnv = val;
    i++;
  } else if (process.argv[i] === '--confirm') {
    confirm = true;
  }
}

const targetEnvs = targetEnv ? [targetEnv] : ['development', 'test'];

async function queryCollection(collectionName, env) {
  const ref = db.collection(collectionName);
  const snapshot = await ref.where('env', '==', env).get();
  return snapshot.docs.map(doc => doc.id);
}

async function cleanup() {
  console.log(`Starting env-based cleanup (env: ${targetEnvs.join(', ')})...\n`);

  const listingsCol = `${prefix}listings`;
  const haulsCol = `${prefix}hauls`;

  // Query listings
  console.log('📋 Querying listings...');
  const listingIds = [];
  for (const env of targetEnvs) {
    const ids = await queryCollection(listingsCol, env);
    console.log(`   env='${env}': ${ids.length} listings`);
    listingIds.push(...ids);
  }

  // Query hauls
  console.log('📋 Querying hauls...');
  const haulIds = [];
  for (const env of targetEnvs) {
    const ids = await queryCollection(haulsCol, env);
    console.log(`   env='${env}': ${ids.length} hauls`);
    haulIds.push(...ids);
  }

  // Summary
  console.log(`\n📊 Env-Tagged Data Found:`);
  console.log(`   Listings to delete: ${listingIds.length}`);
  console.log(`   Hauls to delete: ${haulIds.length}`);

  if (listingIds.length === 0 && haulIds.length === 0) {
    console.log('\n✅ No env-tagged data found!');
    process.exit(0);
  }

  // Show samples
  if (listingIds.length > 0) {
    console.log(`\n   Sample listing IDs to delete:`);
    listingIds.slice(0, 5).forEach(id => console.log(`     - ${id}`));
    if (listingIds.length > 5) {
      console.log(`     ... and ${listingIds.length - 5} more`);
    }
  }

  if (haulIds.length > 0) {
    console.log(`\n   Sample haul IDs to delete:`);
    haulIds.slice(0, 5).forEach(id => console.log(`     - ${id}`));
    if (haulIds.length > 5) {
      console.log(`     ... and ${haulIds.length - 5} more`);
    }
  }

  // Confirm deletion
  console.log('\n⚠️  This will DELETE these records from Firebase.');
  console.log('   This action cannot be undone.\n');

  if (!confirm) {
    console.log('To execute deletion, run with --confirm flag:');
    const envFlag = targetEnv ? ` --env ${targetEnv}` : '';
    console.log(`  node scripts/cleanup-env-data.mjs${envFlag} --confirm\n`);
    process.exit(0);
  }

  // Delete listings
  if (listingIds.length > 0) {
    console.log('\n🗑️  Deleting env-tagged listings...');
    const listingsRef = db.collection(listingsCol);
    let deleted = 0;
    for (const id of listingIds) {
      await listingsRef.doc(id).delete();
      deleted++;
      if (deleted % 10 === 0) {
        console.log(`   Deleted ${deleted}/${listingIds.length} listings...`);
      }
    }
  }

  // Delete hauls
  if (haulIds.length > 0) {
    console.log('\n🗑️  Deleting env-tagged hauls...');
    const haulsRef = db.collection(haulsCol);
    let deleted = 0;
    for (const id of haulIds) {
      await haulsRef.doc(id).delete();
      deleted++;
      if (deleted % 10 === 0) {
        console.log(`   Deleted ${deleted}/${haulIds.length} hauls...`);
      }
    }
  }

  console.log('\n✅ Cleanup complete!');
  console.log(`   Deleted ${listingIds.length} listings`);
  console.log(`   Deleted ${haulIds.length} hauls\n`);

  process.exit(0);
}

cleanup().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
