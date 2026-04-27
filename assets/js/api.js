// ============================================================
//  NEXUS CORE — api.js (v2)
//  Comunicación con Google Sheets via proxy Vercel
//  El browser llama a /api/sheets (sin CORS)
//  El servidor llama a Apps Script (server-to-server)
// ============================================================

const API = (() => {

  const PROXY_URL = '/api/sheets';
  const TIMEOUT_MS = 15000;
  let _url = '';

  function setUrl(url)    { _url = url.trim(); }
  function getUrl()       { return _url; }
  function isConnected()  { return true; } // Proxy siempre disponible en Vercel

  async function call(params) {
    const qs      = new URLSearchParams(params).toString();
    const fullUrl = `${PROXY_URL}?${qs}`;
    const controller = new AbortController();
    const timer   = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res  = await fetch(fullUrl, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado.');
      throw err;
    }
  }

  async function getAll()                          { return call({ action: 'getAll' }); }
  async function saveMembers(clanId, members)      { return call({ action: 'saveMembers', clan: clanId, members: JSON.stringify(members) }); }
  async function saveWar(clanId, war)              { return call({ action: 'saveWar', clan: clanId, war: JSON.stringify(war) }); }
  async function saveRotation(rotation)            { return call({ action: 'saveRotation', rotation: JSON.stringify(rotation) }); }
  async function saveActivity(entry)               { return call({ action: 'saveActivity', entry: JSON.stringify(entry) }); }

  async function saveMembersWithLog(clanId, members, actionLabel, userName) {
    const entry = { action: actionLabel, clan: clanId, user: userName || '—', date: new Date().toLocaleDateString('es-MX') };
    await Promise.all([saveMembers(clanId, members), saveActivity(entry)]);
  }

  function validateUrl(url) {
    if (!url || !url.startsWith('https://script.google.com'))
      return { ok: false, error: 'La URL debe empezar con https://script.google.com' };
    return { ok: true };
  }

  return { setUrl, getUrl, isConnected, getAll, saveMembers, saveWar, saveRotation, saveActivity, saveMembersWithLog, validateUrl };
})();