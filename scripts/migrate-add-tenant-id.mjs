// scripts/migrate-add-tenant-id.mjs
// Ajoute le champ tenant_id: "lab_ilovesmile" sur tous les documents existants.
// IDEMPOTENT : peut être rejoué sans effet si déjà migré.
// Dry-run par défaut si --dry-run est passé en arg.

import admin from 'firebase-admin';
import fs from 'node:fs';

const TENANT_ID = 'lab_ilovesmile';
const DRY_RUN = process.argv.includes('--dry-run');
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT
  || './scripts/.service-account.json';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Missing service account at ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function migrateCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  let toMigrate = 0, alreadyOk = 0;

  // Phase 1 : compter
  for (const doc of snap.docs) {
    if (doc.data().tenant_id) alreadyOk++;
    else toMigrate++;
  }
  console.log(`${collectionName}: ${toMigrate} à migrer, ${alreadyOk} déjà ok`);

  if (toMigrate === 0) return;
  if (DRY_RUN) {
    snap.docs.forEach(doc => {
      if (!doc.data().tenant_id) console.log(`  [DRY] ${collectionName}/${doc.id}`);
    });
    return;
  }

  // Phase 2 : migrer par lots (batch max 500 opérations)
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let ops = 0, written = 0;

  for (const doc of snap.docs) {
    if (doc.data().tenant_id) continue;
    batch.update(doc.ref, { tenant_id: TENANT_ID });
    ops++;
    if (ops >= BATCH_SIZE) {
      await batch.commit();
      written += ops;
      process.stdout.write(`  ${written}/${toMigrate} écrits\r`);
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) {
    await batch.commit();
    written += ops;
  }
  console.log(`  ✓ ${written}/${toMigrate} écrits`);
}

console.log(DRY_RUN ? '=== DRY RUN ===' : '=== MIGRATION RÉELLE ===');
console.log(`Cible : tenant_id = "${TENANT_ID}"`);

await migrateCollection('prescriptions');
await migrateCollection('contacts');
await migrateCollection('tarifs');
await migrateCollection('meta');

console.log(DRY_RUN
  ? '\nDRY RUN terminé — rejouer sans --dry-run pour migrer'
  : '\n✓ Migration terminée');
process.exit(0);
