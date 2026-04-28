// ============================================================
//  NEXUS CORE — Google Apps Script v2
//  Compatible con nexus_core.html (versión completa con login)
//
//  INSTRUCCIONES:
//  1. Abre tu Google Sheet
//  2. Ve a Extensions > Apps Script
//  3. Borra el código anterior y pega este completo
//  4. Guarda con Ctrl+S
//  5. Deploy > New deployment (o "Manage deployments" > edit si ya tienes uno)
//     - Type: Web App
//     - Execute as: Me
//     - Who has access: Anyone
//  6. Copia la URL y pégala en el dashboard (Configuración)
//
//  PESTAÑAS QUE CREA AUTOMÁTICAMENTE:
//  Miembros_crushers, Miembros_northwestern, Miembros_mexico, Miembros_tranqui
//  Guerras_crushers, Guerras_northwestern, Guerras_mexico, Guerras_tranqui
//  Rotaciones
//  Usuarios
//  Actividad
// ============================================================

const CLAN_IDS = ['crushers', 'northwestern', 'mexico', 'tranqui'];

function doGet(e)     { return handle(e); }
function doPost(e)    { return handle(e); }
function doOptions(e) { return buildResponse('{}'); } // Preflight CORS

function handle(e) {
  // Leer parámetros de GET o de POST body (application/x-www-form-urlencoded)
  let p = Object.assign({}, e.parameter || {});

  if (e.postData && e.postData.contents) {
    try {
      e.postData.contents.split('&').forEach(pair => {
        const parts = pair.split('=');
        const k = decodeURIComponent(parts[0].replace(/\+/g, ' '));
        const v = decodeURIComponent((parts[1] || '').replace(/\+/g, ' '));
        if (k && !(k in p)) p[k] = v;
      });
    } catch(err) {}
  }

  let result;
  try {
    switch (p.action) {
      case 'getAll':       result = getAll();                                               break;
      case 'saveMembers':  saveMembersSheet(p.clan, JSON.parse(p.members)); result={ok:true}; break;
      case 'saveWar':      saveWarSheet(p.clan, JSON.parse(p.war));         result={ok:true}; break;
      case 'saveRotation': saveRotationSheet(JSON.parse(p.rotation));       result={ok:true}; break;
      case 'saveActivity':  saveActivitySheet(JSON.parse(p.entry));         result={ok:true}; break;
      case 'replaceWars':   replaceWarsSheet(p.clan, JSON.parse(p.wars));     result={ok:true}; break;
      default:             result = { error: 'Acción desconocida: ' + (p.action || 'ninguna') };
    }
  } catch(err) {
    result = { error: err.message };
  }
  return buildResponse(JSON.stringify(result));
}

// Respuesta con headers CORS — necesario para requests desde Vercel
function buildResponse(body) {
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── getAll ────────────────────────────────────────────────────
// Devuelve todos los datos: miembros, guerras, rotaciones y usuarios
function getAll() {
  const result = {};

  // Clanes
  CLAN_IDS.forEach(id => {
    const ms = getOrCreate('Miembros_' + id, MEMBER_HEADERS);
    const ws = getOrCreate('Guerras_'  + id, WAR_HEADERS);
    result[id] = {
      members: sheetToObjects(ms, MEMBER_HEADERS),
      wars:    sheetToObjects(ws, WAR_HEADERS),
    };
  });

  // Rotaciones
  const rs = getOrCreate('Rotaciones', ROT_HEADERS);
  result.rotations = sheetToObjects(rs, ROT_HEADERS);

  // Usuarios (solo devuelve campos públicos — sin contraseñas en texto plano si quieres más seguridad)
  // Por simplicidad los devolvemos completos; en producción podrías hashear las contraseñas
  const us = getOrCreate('Usuarios', USER_HEADERS);
  result.users = sheetToObjects(us, USER_HEADERS);

  return result;
}

// ── Miembros ─────────────────────────────────────────────────
const MEMBER_HEADERS = [
  'id', 'name', 'tag', 'role',
  'warTotal', 'warAttacks',
  'cwlTotal', 'cwlAtkTotal', 'cwlMirrors',
  'donTotal'
];

function saveMembersSheet(clan, members) {
  const sheet = getOrCreate('Miembros_' + clan, MEMBER_HEADERS);
  clearData(sheet);
  members.forEach(m => {
    sheet.appendRow(MEMBER_HEADERS.map(h => m[h] !== undefined ? m[h] : ''));
  });
}

// ── Guerras ───────────────────────────────────────────────────
const WAR_HEADERS = ['date', 'type', 'result', 'starsUs', 'starsThem'];

function saveWarSheet(clan, war) {
  const sheet = getOrCreate('Guerras_' + clan, WAR_HEADERS);
  sheet.appendRow(WAR_HEADERS.map(h => war[h] || ''));
}

// ── Rotaciones ────────────────────────────────────────────────
const ROT_HEADERS = ['date', 'tag', 'name', 'from', 'to', 'don'];

function saveRotationSheet(rot) {
  const sheet = getOrCreate('Rotaciones', ROT_HEADERS);
  sheet.appendRow(ROT_HEADERS.map(h => rot[h] || ''));
}

// ── Actividad ─────────────────────────────────────────────────
const ACTIVITY_HEADERS = ['action', 'clan', 'user', 'date'];

function saveActivitySheet(entry) {
  const sheet = getOrCreate('Actividad', ACTIVITY_HEADERS);
  sheet.appendRow(ACTIVITY_HEADERS.map(h => entry[h] || ''));
}

// ── Usuarios ─────────────────────────────────────────────────
// La pestaña Usuarios tiene esta estructura. Edítala directamente en Sheets.
const USER_HEADERS = ['user', 'pass', 'role', 'name', 'clan'];

function ensureDefaultUsers() {
  const sheet = getOrCreate('Usuarios', USER_HEADERS);
  if (sheet.getLastRow() <= 1) {
    const defaults = [
      ['turpial', 'nexus2024', 'super',  'Turpial',  ''],
      ['lider1',  'clan1234',  'leader', 'Líder 1',  'crushers'],
      ['lider2',  'clan1234',  'leader', 'Líder 2',  'northwestern'],
      ['lider3',  'clan1234',  'leader', 'Líder 3',  'mexico'],
      ['lider4',  'clan1234',  'leader', 'Líder 4',  'tranqui'],
    ];
    defaults.forEach(row => sheet.appendRow(row));
  }
}

// ── Reemplazar historial completo de guerras ─────────────────
function replaceWarsSheet(clan, wars) {
  const sheet = getOrCreate('Guerras_' + clan, WAR_HEADERS);
  clearData(sheet);
  wars.forEach(w => {
    sheet.appendRow(WAR_HEADERS.map(h => w[h] !== undefined ? w[h] : ''));
  });
}

// ── Helpers ───────────────────────────────────────────────────
function getOrCreate(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setValues([headers]);
    hRange.setFontWeight('bold').setBackground('#7F77DD').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clearData(sheet) {
  const last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
}

function sheetToObjects(sheet, headers) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = row[i];
      // Convertir números guardados como string
      obj[h] = (v !== '' && !isNaN(v)) ? Number(v) : v;
    });
    return obj;
  }).filter(obj => obj[headers[0]] !== '' && obj[headers[0]] !== undefined);
}

// ── Setup inicial (ejecutar manualmente una vez si quieres) ───
function setup() {
  CLAN_IDS.forEach(id => {
    getOrCreate('Miembros_' + id, MEMBER_HEADERS);
    getOrCreate('Guerras_'  + id, WAR_HEADERS);
  });
  getOrCreate('Rotaciones', ROT_HEADERS);
  getOrCreate('Actividad',  ACTIVITY_HEADERS);
  ensureDefaultUsers();
  SpreadsheetApp.getUi().alert('NEXUS CORE configurado correctamente. Las pestañas están listas.');
}