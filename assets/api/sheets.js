// ============================================================
//  NEXUS CORE — api/sheets.js
//  Vercel Serverless Function — Proxy para Google Apps Script
//  Resuelve el problema de CORS haciendo el fetch server-side
//
//  Endpoint: /api/sheets?action=...&param=...
//  El browser llama a /api/sheets (mismo dominio = sin CORS)
//  Este servidor llama a Apps Script (server-to-server = sin CORS)
// ============================================================

const SHEETS_URL = process.env.SHEETS_URL;

export default async function handler(req, res) {
  // Headers CORS para el browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar que la URL de Sheets esté configurada
  if (!SHEETS_URL) {
    return res.status(500).json({
      error: 'SHEETS_URL no configurada. Agrégala en las variables de entorno de Vercel.'
    });
  }

  try {
    // Pasar todos los query params al Apps Script
    const params = new URLSearchParams(req.query).toString();
    const url = `${SHEETS_URL}?${params}`;

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    const text = await response.text();

    // Intentar parsear como JSON
    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch {
      // Si no es JSON válido devolver el texto para debug
      return res.status(200).send(text);
    }

  } catch (err) {
    return res.status(500).json({
      error: `Error al conectar con Google Sheets: ${err.message}`
    });
  }
}