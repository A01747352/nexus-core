// ============================================================
//  NEXUS CORE — api.js
//  Comunicación con Google Sheets via Google Apps Script
//  Todas las llamadas son GET con parámetros (CORS-friendly)
// ============================================================

const API = (() => {

  // ── Config ────────────────────────────────────────────────
  let _url = '';
  const TIMEOUT_MS = 10000;

  // ── Setup ─────────────────────────────────────────────────
  function setUrl(url) {
    _url = url.trim();
  }

  function getUrl() {
    return _url;
  }

  function isConnected() {
    return _url !== '';
  }

  // ── Core fetch ────────────────────────────────────────────
  async function call(params) {
    if (!_url) throw new Error('No hay URL de Google Sheets configurada.');

    const qs = new URLSearchParams(params).toString();
    const fullUrl = `${_url}?${qs}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(fullUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado. Verifica tu conexión.');
      throw err;
    }
  }

  // ── Endpoints ─────────────────────────────────────────────

  // Trae todos los datos: miembros, guerras, rotaciones, usuarios
  async function getAll() {
    return await call({ action: 'getAll' });
  }

  // Guarda lista completa de miembros de un clan
  async function saveMembers(clanId, members) {
    return await call({
      action: 'saveMembers',
      clan: clanId,
      members: JSON.stringify(members),
    });
  }

  // Agrega un resultado de guerra al historial
  async function saveWar(clanId, war) {
    return await call({
      action: 'saveWar',
      clan: clanId,
      war: JSON.stringify(war),
    });
  }

  // Registra una rotación de Capital Raid
  async function saveRotation(rotation) {
    return await call({
      action: 'saveRotation',
      rotation: JSON.stringify(rotation),
    });
  }

  // Registra una entrada en el log de actividad
  async function saveActivity(entry) {
    return await call({
      action: 'saveActivity',
      entry: JSON.stringify(entry),
    });
  }

  // ── Helpers ───────────────────────────────────────────────

  // Guarda miembros y registra actividad en paralelo
  async function saveMembersWithLog(clanId, members, actionLabel, userName) {
    const entry = {
      action: actionLabel,
      clan: clanId,
      user: userName || '—',
      date: new Date().toLocaleDateString('es-MX'),
    };
    await Promise.all([
      saveMembers(clanId, members),
      saveActivity(entry),
    ]);
  }

  // Verifica que la URL sea válida antes de conectar
  function validateUrl(url) {
    if (!url || !url.startsWith('https://script.google.com')) {
      return { ok: false, error: 'La URL debe empezar con https://script.google.com' };
    }
    return { ok: true };
  }

  // ── API pública ───────────────────────────────────────────
  return {
    setUrl,
    getUrl,
    isConnected,
    getAll,
    saveMembers,
    saveWar,
    saveRotation,
    saveActivity,
    saveMembersWithLog,
    validateUrl,
  };

})();