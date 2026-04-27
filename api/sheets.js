// ============================================================
//  NEXUS CORE — api/sheets.js
//  Vercel Serverless Function — Proxy para Google Apps Script
//  GET para lecturas, POST para escrituras con payload grande
// ============================================================

const SHEETS_URL = process.env.SHEETS_URL;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SHEETS_URL) {
    return res.status(500).json({ error: 'SHEETS_URL no configurada en variables de entorno de Vercel.' });
  }

  try {
    const action = req.query.action;

    // Acciones de escritura con payload grande van por POST
    const writeActions = ['saveMembers', 'saveWar', 'saveRotation', 'saveActivity'];
    const isWrite = writeActions.includes(action);

    let response;

    if (isWrite) {
      // Mandamos el body como JSON via POST
      // Apps Script lo recibe en e.postData.contents
      const body = { ...req.query };
      response = await fetch(SHEETS_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
      });
    } else {
      // Lecturas (getAll) van por GET normal
      const qs = new URLSearchParams(req.query).toString();
      response = await fetch(`${SHEETS_URL}?${qs}`, {
        method: 'GET',
        redirect: 'follow',
      });
    }

    const text = await response.text();

    try {
      return res.status(200).json(JSON.parse(text));
    } catch {
      // Si no es JSON, loguear el texto para debug
      console.error('Apps Script response no es JSON:', text.slice(0, 300));
      return res.status(500).json({ error: 'Respuesta inválida de Apps Script. Verifica el deployment.' });
    }

  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(500).json({ error: `Error de conexión: ${err.message}` });
  }
}