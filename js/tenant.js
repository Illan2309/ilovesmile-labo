// js/tenant.js
// Phase 0 : TENANT_ID hardcodé. Phase 2 : détection dynamique par sous-domaine.

window.TENANT_ID = 'lab_ilovesmile';

// Helper pour toutes les queries Firestore : ajoute le filtre tenant_id.
window.tenantQuery = function(query) {
  return query.where('tenant_id', '==', window.TENANT_ID);
};

// Helper pour toutes les écritures : force le tenant_id dans les données.
window.withTenant = function(data) {
  return { ...data, tenant_id: window.TENANT_ID };
};

console.log('[tenant] TENANT_ID =', window.TENANT_ID);
