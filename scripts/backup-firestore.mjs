import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT
  || './scripts/.service-account.json';
const OUT_DIR = `./backups/firestore-${new Date().toISOString().replace(/[:.]/g, '-')}`;

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Missing service account at ${SERVICE_ACCOUNT_PATH}`);
  console.error('Download from https://console.firebase.google.com/project/ilovesmile-labo-fd511/settings/serviceaccounts/adminsdk');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

fs.mkdirSync(OUT_DIR, { recursive: true });

async function backupCollection(name) {
  const snap = await db.collection(name).get();
  const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`),
    JSON.stringify(docs, null, 2));
  console.log(`✓ ${name} (${docs.length} docs)`);
}

console.log(`Backup -> ${OUT_DIR}`);
await backupCollection('prescriptions');
await backupCollection('contacts');
await backupCollection('tarifs');
await backupCollection('meta');
console.log('Backup complete');
process.exit(0);
