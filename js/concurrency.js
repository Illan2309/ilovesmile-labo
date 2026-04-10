// ══════════════════════════════════════════
// CONCURRENCY — pool de concurrence
// ══════════════════════════════════════════

// POOL DE CONCURRENCE — traite N tâches en parallèle
// ═══════════════════════════════════════════════════
var _rateLimitUntil = 0; // timestamp global pour rate-limit partagé entre workers

async function runWithConcurrency(tasks, maxConcurrent = 2) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      // Attendre si rate-limited globalement
      const now = Date.now();
      if (_rateLimitUntil > now) {
        await new Promise(r => setTimeout(r, _rateLimitUntil - now));
      }
      const i = index++;
      try {
        results[i] = await tasks[i]();
      } catch(e) {
        console.error('[Concurrency] Tâche ' + i + ' échouée :', e);
        results[i] = { error: e.message || 'Erreur inconnue', index: i };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => worker())
  );
  return results;
}
