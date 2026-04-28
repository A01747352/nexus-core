// ============================================================
//  NEXUS CORE — auth.js
//  Manejo de sesión, login, logout y permisos por rol
// ============================================================

const Auth = (() => {

  // ── Estado de sesión ──────────────────────────────────────
  let _session = null;

  // Usuarios por defecto — se sobreescriben al sincronizar con Sheets
  // Cambiarlos directamente en la pestaña "Usuarios" de Google Sheets
  let _users = [
    { user: 'Joj', pass: 'nexus2026', role: 'super',  name: 'Joj', clan: null },
    { user: 'lider1',  pass: 'nexus2026',  role: 'leader', name: 'Líder', clan: 'crushers'    },
    { user: 'lider2',  pass: 'nexus2026',  role: 'leader', name: 'Líder', clan: 'northwestern' },
    { user: 'lider3',  pass: 'nexus2026',  role: 'leader', name: 'Líder', clan: 'mexico'       },
    { user: 'Shabo',  pass: 'nexus2026',  role: 'leader', name: 'Shabo', clan: 'tranqui'      },
  ];

  // ── Login ─────────────────────────────────────────────────
  function login(username, password) {
    const found = _users.find(
      u => u.user === username.trim().toLowerCase() && u.pass === password
    );
    if (!found) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
    _session = { ...found };
    return { ok: true, session: _session };
  }

  // ── Logout ────────────────────────────────────────────────
  function logout() {
    _session = null;
  }

  // ── Sesión activa ─────────────────────────────────────────
  function getSession() {
    return _session;
  }

  function isLoggedIn() {
    return _session !== null;
  }

  // ── Permisos ──────────────────────────────────────────────
  // Super líder puede editar todo
  // Líder solo puede editar su clan asignado
  function canEdit(clanId) {
    if (!_session) return false;
    if (_session.role === 'super') return true;
    return _session.clan === clanId;
  }

  function isSuper() {
    return _session?.role === 'super';
  }

  function isLeader() {
    return _session?.role === 'leader';
  }

  // ── Actualizar usuarios desde Sheets ──────────────────────
  // Se llama después de sincronizar con Google Sheets
  function setUsers(usersFromSheets) {
    if (!Array.isArray(usersFromSheets) || usersFromSheets.length === 0) return;
    _users = usersFromSheets;
  }

  function getUsers() {
    return _users;
  }

  // ── API pública ───────────────────────────────────────────
  return {
    login,
    logout,
    getSession,
    isLoggedIn,
    canEdit,
    isSuper,
    isLeader,
    setUsers,
    getUsers,
  };

})();