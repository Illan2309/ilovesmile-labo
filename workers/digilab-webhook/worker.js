/**
 * Cloudflare Worker — Digilab Webhook + API Proxy
 * 1. Reçoit les commandes de Digilab (POST /v1/order/add) → Firebase
 * 2. Proxy vers l'API publique Digilab (GET/PUT /v1/digilab/*)
 * 3. Proxy fichiers binaires (GET /v1/digilab/proxy-file)
 *
 * Secrets Cloudflare :
 * - DIGILAB_AUTH_TOKEN : token Bearer webhook
 * - DIGILAB_API_KEY : clé API publique Digilab (dlb_live_xxxxx)
 * - FIREBASE_PROJECT_ID : ID projet Firebase
 * - FIREBASE_API_KEY : clé API Firebase Web
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Key',
};

const DIGILAB_API_BASE = 'https://europe-west9-digital-adf.cloudfunctions.net/digilab-inbox-server/public/v1';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── Webhook : POST /v1/order/add ──
    if (request.method === 'POST' && path === '/v1/order/add') {
      return handleOrderAdd(request, env);
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

async function handleOrderAdd(request, env) {
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

  const orderDoc = {
    ...orderData,
    _digilabId: orderId,
    _receivedAt: now,
    _status: 'nouveau',
    _processed: false,
  };

  try {
    await firestoreSet(env, 'digilab_orders', orderId, orderDoc);
  } catch (e) {
    console.error('Firebase write error:', e);
    return jsonResponse({ error: 'Storage error', message: 'Failed to store order.' }, 500);
  }

  return jsonResponse({
    result: 'ok',
    mode: orderData._existingId ? 'update' : 'add',
    id: orderId,
    updatedAt: now,
  }, 200);
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
    return proxyDigilabFile(url, env);
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

async function proxyDigilabFile(url, env) {
  const fileUrl = url.searchParams.get('url');
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

  const dbxToken = env.DROPBOX_TOKEN;
  if (!dbxToken) {
    return jsonResponse({ error: 'Dropbox not configured' }, 500);
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
