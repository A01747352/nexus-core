// ============================================================
//  NEXUS CORE — server.js
//  Servidor Express para Railway
//  Proxy dedicado hacia la API de Clash of Clans
//  Railway tiene IP fija — se autoriza una vez en el portal CoC
// ============================================================

const express = require('express');
const app     = express();
const PORT    = process.env.PORT || 3000;

const COC_API = 'https://api.clashofclans.com/v1';
const COC_KEY = process.env.COC_API_KEY;

const CLAN_TAGS = {
  crushers:     '2RQYUQY0P',
  northwestern: '2GY2Q9GQ0',
  mexico:       '28Q9R0LRU',
  tranqui:      '2JQR92PRG',
};

// ── CORS ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ── Health check ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'NEXUS CORE CoC Proxy', version: '1.0' });
});

// ── CoC Proxy ────────────────────────────────────────────────
app.get('/api/coc', async (req, res) => {
  if (!COC_KEY) {
    return res.status(500).json({ error: 'COC_API_KEY no configurada.' });
  }

  const { action, tag } = req.query;

  try {
    switch (action) {

      case 'clan': {
        const data = await cocFetch(`/clans/%23${encodeTag(tag)}`);
        return res.json(data);
      }

      case 'members': {
        const data = await cocFetch(`/clans/%23${encodeTag(tag)}/members`);
        return res.json(data);
      }

      case 'currentwar': {
        const data = await cocFetch(`/clans/%23${encodeTag(tag)}/currentwar`);
        return res.json(data);
      }

      case 'allclans': {
        const results = {};
        await Promise.all(
          Object.entries(CLAN_TAGS).map(async ([clanId, clanTag]) => {
            const [membersRes, warRes] = await Promise.allSettled([
              cocFetch(`/clans/%23${clanTag}/members`),
              cocFetch(`/clans/%23${clanTag}/currentwar`),
            ]);
            results[clanId] = {
              members:    membersRes.status === 'fulfilled' ? membersRes.value : null,
              currentWar: warRes.status    === 'fulfilled' ? warRes.value     : null,
            };
          })
        );
        return res.json(results);
      }

      default:
        return res.status(400).json({ error: `Acción desconocida: ${action}` });
    }

  } catch (err) {
    console.error('CoC error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────
async function cocFetch(path) {
  const url = `${COC_API}${path}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${COC_KEY}`,
      'Accept':        'application/json',
    },
  });
  if (res.status === 403) throw new Error('API key inválida o IP no autorizada.');
  if (res.status === 404) throw new Error('Clan no encontrado.');
  if (res.status === 429) throw new Error('Rate limit alcanzado.');
  if (!res.ok)            throw new Error(`CoC API HTTP ${res.status}`);
  return res.json();
}

function encodeTag(tag) {
  return (tag || '').replace(/^#/, '').toUpperCase();
}

app.get('/myip', async (req, res) => {
  const [r1, r2] = await Promise.all([
    fetch('https://api.ipify.org?format=json'),
    fetch('https://api64.ipify.org?format=json'),
  ]);
  const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
  res.json({ ipv4: d1.ip, ipv6: d2.ip });
});
// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`NEXUS CORE CoC Proxy corriendo en puerto ${PORT}`);
});