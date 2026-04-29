// ============================================================
//  NEXUS CORE — api/coc.js
//  Vercel Serverless Function — Proxy para la API de CoC
//  La API key vive en Vercel env vars, nunca en el frontend
//
//  Endpoints disponibles:
//  GET /api/coc?action=clan&tag=2RQYUQY0P
//  GET /api/coc?action=members&tag=2RQYUQY0P
//  GET /api/coc?action=currentwar&tag=2RQYUQY0P
//  GET /api/coc?action=allclans
// ============================================================

const COC_API  = 'https://api.clashofclans.com/v1';
const COC_KEY  = process.env.COC_API_KEY;

const CLAN_TAGS = {
  crushers:    '2RQYUQY0P',
  northwestern:'2GY2Q9GQ0',
  mexico:      '28Q9R0LRU',
  tranqui:     '2JQR92PRG',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!COC_KEY) {
    return res.status(500).json({ error: 'COC_API_KEY no configurada en Vercel.' });
  }

  const { action, tag } = req.query;

  try {
    switch (action) {

      // Info general de un clan
      case 'clan': {
        const data = await cocFetch(`/clans/%23${encodeTag(tag)}`);
        return res.status(200).json(data);
      }

      // Lista de miembros de un clan con sus donaciones
      case 'members': {
        const data = await cocFetch(`/clans/%23${encodeTag(tag)}/members`);
        return res.status(200).json(data);
      }

      // Guerra activa de un clan
      case 'currentwar': {
        const data = await cocFetch(`/clans/%23${encodeTag(tag)}/currentwar`);
        return res.status(200).json(data);
      }

      // Sync completo: miembros + guerra activa de los 4 clanes
      case 'allclans': {
        const results = {};
        await Promise.all(
          Object.entries(CLAN_TAGS).map(async ([clanId, clanTag]) => {
            const [membersRes, warRes] = await Promise.allSettled([
              cocFetch(`/clans/%23${clanTag}/members`),
              cocFetch(`/clans/%23${clanTag}/currentwar`),
            ]);

            results[clanId] = {
              members: membersRes.status === 'fulfilled' ? membersRes.value : null,
              currentWar: warRes.status === 'fulfilled' ? warRes.value : null,
            };
          })
        );
        return res.status(200).json(results);
      }

      default:
        return res.status(400).json({ error: `Acción desconocida: ${action}` });
    }

  } catch (err) {
    console.error('CoC API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── Helpers ───────────────────────────────────────────────────

async function cocFetch(path) {
  const url = `${COC_API}${path}`;
  console.log('Fetching:', url);
  console.log('Key starts with:', COC_KEY?.substring(0, 30));
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${COC_KEY}`,
      'Accept': 'application/json',
    },
  });
  console.log('Response status:', res.status);

  if (res.status === 403) throw new Error('API key inválida o IP no autorizada.');
  if (res.status === 404) throw new Error('Clan no encontrado.');
  if (res.status === 429) throw new Error('Límite de requests alcanzado. Intenta en un momento.');
  if (!res.ok) throw new Error(`CoC API error: HTTP ${res.status}`);

  return res.json();
}

// Normaliza el tag — quita el # si viene incluido
function encodeTag(tag) {
  return (tag || '').replace(/^#/, '').toUpperCase();
}