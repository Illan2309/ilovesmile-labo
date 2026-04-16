/**
 * Cloudflare Worker — Digilab Webhook + API Proxy
 * 1. Reçoit les commandes de Digilab (POST /v1/order/add) → Firebase
 * 2. Proxy vers l'API publique Digilab (GET/PUT /v1/digilab/*)
 * 3. Proxy fichiers binaires (GET /v1/digilab/proxy-file)
 * 4. Proxy Dropbox avec refresh token automatique
 *
 * Secrets Cloudflare :
 * - DIGILAB_AUTH_TOKEN : token Bearer webhook
 * - DIGILAB_API_KEY : clé API publique Digilab (dlb_live_xxxxx)
 * - FIREBASE_PROJECT_ID : ID projet Firebase
 * - FIREBASE_API_KEY : clé API Firebase Web
 * - DROPBOX_REFRESH_TOKEN : refresh token Dropbox (longue durée)
 * - DROPBOX_APP_KEY : App Key de l'app Dropbox
 * - DROPBOX_APP_SECRET : App Secret de l'app Dropbox
 * - DROPBOX_TOKEN : (legacy) token court, remplacé par le refresh flow
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Key, Dropbox-API-Arg',
};

const DIGILAB_API_BASE = 'https://europe-west9-digital-adf.cloudfunctions.net/digilab-inbox-server/public/v1';

// ═══════════════════════════════════════════
// DROPBOX TOKEN REFRESH (les access tokens expirent après 4h)
// ═══════════════════════════════════════════

let _cachedDropboxToken = null;
let _cachedDropboxTokenExpiry = 0;

async function getDropboxToken(env) {
  // Si on a un token en cache encore valide (marge de 5 min)
  if (_cachedDropboxToken && Date.now() < _cachedDropboxTokenExpiry - 300000) {
    return _cachedDropboxToken;
  }

  // Si refresh token configuré → rafraîchir automatiquement
  if (env.DROPBOX_REFRESH_TOKEN && env.DROPBOX_APP_KEY && env.DROPBOX_APP_SECRET) {
    try {
      const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: env.DROPBOX_REFRESH_TOKEN,
          client_id: env.DROPBOX_APP_KEY,
          client_secret: env.DROPBOX_APP_SECRET,
        }).toString(),
      });
      if (resp.ok) {
        const data = await resp.json();
        _cachedDropboxToken = data.access_token;
        // expires_in est en secondes (typiquement 14400 = 4h)
        _cachedDropboxTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
        console.log('[DROPBOX] Token refreshed, expires in', data.expires_in, 's');
        return _cachedDropboxToken;
      }
      console.error('[DROPBOX] Token refresh failed:', resp.status, await resp.text());
    } catch (e) {
      console.error('[DROPBOX] Token refresh error:', e.message);
    }
  }

  // Fallback : token statique (legacy, peut être expiré)
  if (env.DROPBOX_TOKEN) {
    return env.DROPBOX_TOKEN;
  }

  return null;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── Webhook : POST /v1/order/add ──
    if (request.method === 'POST' && path === '/v1/order/add') {
      return handleOrderAdd(request, env, ctx);
    }

    // ── Proxy API Digilab ──
    if (path.startsWith('/v1/digilab/')) {
      return handleDigilabProxy(request, env, url, path);
    }

    // ── Proxy Dropbox API ──
    if (path.startsWith('/v1/dropbox/')) {
      return handleDropboxProxy(request, env, url, path);
    }

    // ── Firebase orders (legacy) ──
    if (request.method === 'GET' && path === '/v1/orders') {
      return handleListOrders(request, env);
    }
    if (request.method === 'GET' && path.startsWith('/v1/orders/')) {
      const id = path.split('/v1/orders/')[1];
      if (id) return handleGetOrder(id, env);
    }

    // ── Health ──
    if (path === '/health' || path === '/') {
      return jsonResponse({ status: 'ok', service: 'digilab-webhook-ils' });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};

// ═══════════════════════════════════════════
// WEBHOOK — Recevoir une commande Digilab
// ═══════════════════════════════════════════

async function handleOrderAdd(request, env, ctx) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token || token !== env.DIGILAB_AUTH_TOKEN) {
    return jsonResponse({ error: 'Invalid API key', message: 'The provided API key is invalid or missing.' }, 401);
  }

  let orderData;
  try {
    orderData = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON', message: 'Request body is not valid JSON.' }, 400);
  }

  if (!orderData || typeof orderData !== 'object') {
    return jsonResponse({ error: 'Invalid input', message: 'Order data is required.' }, 400);
  }

  const now = new Date().toISOString();
  const orderId = orderData._id || orderData.id || ('dlb_' + Date.now());
  const patientName = (orderData.patient_name || 'patient').toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
  const stagingPath = '/ILoveSmile/STAGING/' + orderId + '_' + patientName;

  const orderDoc = {
    ...orderData,
    _digilabId: orderId,
    _receivedAt: now,
    _status: 'nouveau',
    _processed: false,
    _dropboxStagingPath: stagingPath,
    _dropboxFiles: [],
  };

  // 1. Sauvegarder dans Firebase IMMÉDIATEMENT (rapide)
  try {
    await firestoreSet(env, 'digilab_orders', orderId, orderDoc);
  } catch (e) {
    console.error('Firebase write error:', e);
    return jsonResponse({ error: 'Storage error', message: 'Failed to store order.' }, 500);
  }

  // 2. Répondre à Digilab IMMÉDIATEMENT (pas de timeout)
  const response = jsonResponse({
    result: 'ok',
    mode: orderData._existingId ? 'update' : 'add',
    id: orderId,
    updatedAt: now,
  }, 200);

  // 3. Upload Dropbox EN ARRIÈRE-PLAN (via waitUntil, pas de timeout pour Digilab)
  if (ctx && (env.DROPBOX_REFRESH_TOKEN || env.DROPBOX_TOKEN) && orderData.files && orderData.files.length) {
    ctx.waitUntil(_uploadToDropboxStaging(env, orderData, orderId, patientName, stagingPath));
  }

  return response;
}

// Upload fichiers vers Dropbox staging en arrière-plan
async function _uploadToDropboxStaging(env, orderData, orderId, patientName, stagingPath) {
  const service = (orderData.service || '').toLowerCase();
  const needsFilter = ['medit', 'dscore2', 'shining3d'].some(s => service.includes(s));
  const dropboxPaths = [];

  try {
    const dbxToken = await getDropboxToken(env);
    if (!dbxToken) { console.error('[DROPBOX] No token available for staging upload'); return; }

    // Créer le dossier staging
    await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + dbxToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: stagingPath, autorename: false }),
    });

    // Uploader chaque fichier
    for (const file of orderData.files) {
      const fileName = (file.name || '').split('/').pop();
      if (!fileName || !file.url) continue;
      if (needsFilter && /^(POF_|FULL_POF_)/i.test(fileName)) continue;

      try {
        const fileResp = await fetch(file.url);
        if (!fileResp.ok) continue;
        const fileBuffer = await fileResp.arrayBuffer();

        await fetch('https://content.dropboxapi.com/2/files/upload', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + dbxToken,
            'Dropbox-API-Arg': JSON.stringify({ path: stagingPath + '/' + fileName, mode: 'add', autorename: true, mute: true }),
            'Content-Type': 'application/octet-stream',
          },
          body: fileBuffer,
        });
        dropboxPaths.push(stagingPath + '/' + fileName);
      } catch (e) {
        console.error('Dropbox upload error for', fileName, e);
      }
    }

    // Mettre à jour Firebase avec les chemins Dropbox (MERGE, pas écrasement)
    if (dropboxPaths.length > 0) {
      await firestoreUpdate(env, 'digilab_orders', orderId, {
        _dropboxFiles: dropboxPaths,
        _dropboxStagingPath: stagingPath,
        _dropboxUploadedAt: new Date().toISOString(),
      });
    }

    console.log('Background: uploaded', dropboxPaths.length, 'files for', orderId);
  } catch (e) {
    console.error('Background Dropbox error:', e);
  }
}

// ═══════════════════════════════════════════
// PROXY API DIGILAB
// ═══════════════════════════════════════════

async function handleDigilabProxy(request, env, url, path) {
  // Auth frontend → worker
  const appKey = url.searchParams.get('key') || request.headers.get('X-App-Key') || '';
  if (appKey !== env.DIGILAB_AUTH_TOKEN) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Proxy fichier binaire (ZIP, STL, etc.)
  if (path === '/v1/digilab/proxy-file') {
    return proxyDigilabFile(url, env, request);
  }

  // Proxy API REST Digilab
  const apiPath = path.replace('/v1/digilab', '');
  return proxyDigilabApi(request, env, apiPath, url.search);
}

async function proxyDigilabApi(request, env, apiPath, queryString) {
  const targetUrl = DIGILAB_API_BASE + apiPath + queryString;

  const headers = {
    'X-API-Key': env.DIGILAB_API_KEY,
    'Content-Type': 'application/json',
  };

  const opts = { method: request.method, headers };

  if (request.method === 'PUT' || request.method === 'POST') {
    try {
      opts.body = await request.text();
    } catch (e) {}
  }

  try {
    const resp = await fetch(targetUrl, opts);
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (e) {
    return jsonResponse({ error: 'Proxy error', message: e.message }, 502);
  }
}

async function proxyDigilabFile(url, env, request) {
  // Accepter l'URL en query param OU en body POST (pour les URLs longues avec &)
  let fileUrl = url.searchParams.get('url');
  if (!fileUrl && request && request.method === 'POST') {
    try {
      const body = await request.json();
      fileUrl = body.url;
    } catch (e) {}
  }
  if (!fileUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  try {
    const resp = await fetch(fileUrl);
    if (!resp.ok) {
      return jsonResponse({ error: 'File download failed', status: resp.status }, resp.status);
    }

    // Stream le fichier directement sans le stocker en mémoire
    const headers = {
      ...CORS_HEADERS,
      'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Disposition': resp.headers.get('Content-Disposition') || 'attachment',
    };
    const contentLength = resp.headers.get('Content-Length');
    if (contentLength) headers['Content-Length'] = contentLength;

    return new Response(resp.body, { status: 200, headers });
  } catch (e) {
    return jsonResponse({ error: 'File proxy error', message: e.message }, 502);
  }
}

// ═══════════════════════════════════════════
// PROXY DROPBOX API
// ═══════════════════════════════════════════

async function handleDropboxProxy(request, env, url, path) {
  // Auth frontend → worker
  const appKey = url.searchParams.get('key') || request.headers.get('X-App-Key') || '';
  if (appKey !== env.DIGILAB_AUTH_TOKEN) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const dbxToken = await getDropboxToken(env);
  if (!dbxToken) {
    return jsonResponse({ error: 'Dropbox not configured (no token or refresh token)' }, 500);
  }

  // POST /v1/dropbox/create-folder
  if (path === '/v1/dropbox/create-folder' && request.method === 'POST') {
    const body = await request.json();
    const resp = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + dbxToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: body.path, autorename: false }),
    });
    const data = await resp.text();
    return new Response(data, { status: resp.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }

  // POST /v1/dropbox/upload — upload fichier (< 150 MB)
  if (path === '/v1/dropbox/upload' && request.method === 'POST') {
    const dropboxArg = request.headers.get('Dropbox-API-Arg') || '{}';
    const fileBody = await request.arrayBuffer();

    const resp = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + dbxToken,
        'Dropbox-API-Arg': dropboxArg,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBody,
    });
    const data = await resp.text();
    return new Response(data, { status: resp.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }

  // POST /v1/dropbox/upload-from-url — télécharge un fichier externe et l'upload sur Dropbox
  if (path === '/v1/dropbox/upload-from-url' && request.method === 'POST') {
    const body = await request.json();
    const fileUrl = body.url;
    const dropboxPath = body.path;

    if (!fileUrl || !dropboxPath) {
      return jsonResponse({ error: 'Missing url or path' }, 400);
    }

    try {
      // Télécharger le fichier depuis l'URL
      const fileResp = await fetch(fileUrl);
      if (!fileResp.ok) {
        return jsonResponse({ error: 'File download failed', status: fileResp.status }, 502);
      }
      const fileBuffer = await fileResp.arrayBuffer();

      // Upload vers Dropbox
      const resp = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + dbxToken,
          'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'add', autorename: true, mute: true }),
          'Content-Type': 'application/octet-stream',
        },
        body: fileBuffer,
      });
      const data = await resp.text();
      return new Response(data, { status: resp.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    } catch (e) {
      return jsonResponse({ error: 'Upload from URL failed', message: e.message }, 502);
    }
  }

  // POST /v1/dropbox/share — créer un lien partagé
  if (path === '/v1/dropbox/share' && request.method === 'POST') {
    const body = await request.json();
    const resp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + dbxToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: body.path,
        settings: { requested_visibility: { '.tag': 'public' }, audience: { '.tag': 'public' } }
      }),
    });
    let data = await resp.text();

    // Si le lien existe déjà (409), récupérer l'existant
    if (resp.status === 409) {
      const existing = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + dbxToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: body.path, direct_only: true }),
      });
      data = await existing.text();
      const parsed = JSON.parse(data);
      if (parsed.links && parsed.links.length) {
        return jsonResponse({ url: parsed.links[0].url });
      }
    }

    try {
      const parsed = JSON.parse(data);
      return jsonResponse({ url: parsed.url || '' });
    } catch (e) {
      return new Response(data, { status: resp.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }
  }

  // POST /v1/dropbox/list-folder — lister les fichiers d'un dossier
  if (path === '/v1/dropbox/list-folder' && request.method === 'POST') {
    const body = await request.json();
    const resp = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + dbxToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: body.path, recursive: false, limit: 200 }),
    });
    const data = await resp.text();
    return new Response(data, { status: resp.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }

  // POST /v1/dropbox/download — télécharger un fichier depuis Dropbox
  if (path === '/v1/dropbox/download' && request.method === 'POST') {
    const body = await request.json();
    const resp = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + dbxToken,
        'Dropbox-API-Arg': JSON.stringify({ path: body.path }),
      },
    });
    if (!resp.ok) {
      const err = await resp.text();
      return jsonResponse({ error: 'Download failed', detail: err }, resp.status);
    }
    return new Response(resp.body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
      },
    });
  }

  // POST /v1/dropbox/share-email — partager un dossier par email via Dropbox
  if (path === '/v1/dropbox/share-email' && request.method === 'POST') {
    const body = await request.json();
    const folderPath = body.path;
    const email = body.email;
    if (!folderPath || !email) return jsonResponse({ error: 'Missing path or email' }, 400);

    // Étape 1 : partager le dossier (shared folder)
    const shareResp = await fetch('https://api.dropboxapi.com/2/sharing/share_folder', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + dbxToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath, force_async: false }),
    });
    const shareData = await shareResp.json();
    const sharedFolderId = shareData.shared_folder_id || (shareData['.tag'] === 'complete' ? shareData.shared_folder_id : null);

    // Si déjà partagé (409), récupérer l'ID
    let folderId = sharedFolderId;
    if (!folderId && shareData.error_summary && shareData.error_summary.includes('already_shared')) {
      const metaResp = await fetch('https://api.dropboxapi.com/2/sharing/get_folder_metadata', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + dbxToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_folder_id: shareData.error?.shared_folder_id || '' }),
      });
      const metaData = await metaResp.json();
      folderId = metaData.shared_folder_id;
    }

    if (!folderId) {
      return jsonResponse({ error: 'Could not share folder', detail: shareData }, 400);
    }

    // Étape 2 : ajouter le fournisseur comme viewer
    const addResp = await fetch('https://api.dropboxapi.com/2/sharing/add_folder_member', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + dbxToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shared_folder_id: folderId,
        members: [{ member: { '.tag': 'email', email: email }, access_level: { '.tag': 'viewer' } }],
        quiet: false,
        custom_message: 'Scan files for your order - I Love Smile Dental Lab',
      }),
    });
    const addData = await addResp.text();
    return new Response(addData || '{"ok":true}', { status: addResp.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }

  // POST /v1/dropbox/copy — copier un fichier dans Dropbox
  if (path === '/v1/dropbox/copy' && request.method === 'POST') {
    const body = await request.json();
    const resp = await fetch('https://api.dropboxapi.com/2/files/copy_v2', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + dbxToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_path: body.from, to_path: body.to, autorename: true }),
    });
    const data = await resp.text();
    return new Response(data, { status: resp.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }

  return jsonResponse({ error: 'Unknown dropbox endpoint' }, 404);
}

// ═══════════════════════════════════════════
// FIREBASE ORDERS (frontend queries)
// ═══════════════════════════════════════════

async function handleListOrders(request, env) {
  const url = new URL(request.url);
  const appKey = url.searchParams.get('key') || request.headers.get('X-App-Key') || '';
  if (appKey !== env.DIGILAB_AUTH_TOKEN) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const orders = await firestoreList(env, 'digilab_orders');
    return jsonResponse({ orders, total: orders.length });
  } catch (e) {
    return jsonResponse({ error: 'Failed to read orders' }, 500);
  }
}

async function handleGetOrder(id, env) {
  try {
    const order = await firestoreGet(env, 'digilab_orders', id);
    if (!order) return jsonResponse({ error: 'Order not found' }, 404);
    return jsonResponse({ order });
  } catch (e) {
    return jsonResponse({ error: 'Failed to read order' }, 500);
  }
}

// ═══════════════════════════════════════════
// FIREBASE FIRESTORE REST
// ═══════════════════════════════════════════

async function firestoreSet(env, collection, docId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${env.FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreDocument(data) }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore PATCH failed (${res.status}): ${errText}`);
  }
}

async function firestoreUpdate(env, collection, docId, data) {
  const fields = Object.keys(data);
  const mask = fields.map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${env.FIREBASE_API_KEY}&${mask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreDocument(data) }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore UPDATE failed (${res.status}): ${errText}`);
  }
}

async function firestoreGet(env, collection, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${env.FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET failed (${res.status})`);
  const doc = await res.json();
  return fromFirestoreDocument(doc.fields || {});
}

async function firestoreList(env, collection) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?key=${env.FIREBASE_API_KEY}&pageSize=100&orderBy=_receivedAt desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore LIST failed (${res.status})`);
  const data = await res.json();
  return (data.documents || []).map(doc => {
    const fields = fromFirestoreDocument(doc.fields || {});
    fields._firestoreId = doc.name.split('/').pop();
    return fields;
  });
}

// ── Firestore conversion ──

function toFirestoreDocument(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) fields[key] = toFirestoreValue(value);
  return fields;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirestoreDocument(value) } };
  return { stringValue: String(value) };
}

function fromFirestoreDocument(fields) {
  const obj = {};
  for (const [key, value] of Object.entries(fields)) obj[key] = fromFirestoreValue(value);
  return obj;
}

function fromFirestoreValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreDocument(value.mapValue.fields || {});
  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
