// ============================================================
//  NEXUS CORE — donations.js
//  Registro semanal de donaciones por clan
//  Depende de: auth.js, api.js, store.js
// ============================================================

const Donations = (() => {

  // ── Estado temporal del registro activo ───────────────────
  let _state     = {}; // { [memberId]: number }
  let _activeClan = '';

  // ── Semana actual ─────────────────────────────────────────
  function getCurrentWeek() {
    const now = new Date();
    const weekNum = Math.ceil(now.getDate() / 7);
    const month = now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return { weekNum, label: `Semana ${weekNum} · ${month}` };
  }

  // ── Iniciar registro ──────────────────────────────────────
  function startReg(clanId) {
    _activeClan = clanId;
    _state = {};
    // Inicializar todos los miembros en 0
    Store.getMembers(clanId).forEach(m => { _state[m.id] = 0; });
  }

  // ── Actualizar donación de un miembro ─────────────────────
  function setDonation(memberId, value) {
    _state[memberId] = Math.max(0, parseInt(value) || 0);
    _updateStar(memberId);
  }

  function getDonation(memberId) {
    return _state[memberId] || 0;
  }

  // Proyección: total actual + lo que se va a agregar
  function getProjectedTotal(memberId) {
    const member = Store.getMember(_activeClan, memberId);
    return (member?.donTotal || 0) + (_state[memberId] || 0);
  }

  // ── Guardar semana ────────────────────────────────────────
  async function saveWeek() {
    const members = Store.getMembers(_activeClan);
    let changed = false;

    members.forEach(m => {
      const added = _state[m.id] || 0;
      if (added > 0) {
        m.donTotal = (m.donTotal || 0) + added;
        changed = true;
      }
    });

    if (!changed) return { ok: false, message: 'No hay donaciones nuevas para guardar.' };

    Store.setMembers(_activeClan, members);
    Store.logActivity(`Donaciones ${getCurrentWeek().label}`, _activeClan);
    _state = {};

    if (API.isConnected()) {
      await API.saveMembersWithLog(
        _activeClan,
        members,
        `Donaciones ${getCurrentWeek().label}`,
        Auth.getSession()?.name
      );
    }

    return { ok: true };
  }

  // ── Helpers ───────────────────────────────────────────────

  // Actualiza la estrella en tiempo real mientras se escribe
  function _updateStar(memberId) {
    const starEl = document.getElementById(`dstar-${memberId}`);
    if (!starEl) return;
    const projected = getProjectedTotal(memberId);
    starEl.style.color = projected >= 1000 ? '#EF9F27' : 'var(--text3)';
    starEl.title = projected >= 1000
      ? `★ ${projected} donaciones — ¡supera las 1000!`
      : `${projected} donaciones`;
  }

  // Recalcula todas las estrellas (útil al cargar la vista)
  function refreshStars(clanId) {
    Store.getMembers(clanId).forEach(m => _updateStar(m.id));
  }

  // Resumen de donaciones del clan para mostrar en stats
  function getClanDonationStats(clanId) {
    const members = Store.getMembers(clanId);
    if (!members.length) return { avg: 0, top: null, over1k: 0 };

    const sorted = [...members].sort((a, b) => (b.donTotal || 0) - (a.donTotal || 0));
    const total  = members.reduce((s, m) => s + (m.donTotal || 0), 0);
    const over1k = members.filter(m => (m.donTotal || 0) >= 1000).length;

    return {
      avg:   Math.round(total / members.length),
      top:   sorted[0] || null,
      over1k,
    };
  }

  // ── API pública ───────────────────────────────────────────
  return {
    getCurrentWeek,
    startReg,
    setDonation,
    getDonation,
    getProjectedTotal,
    saveWeek,
    refreshStars,
    getClanDonationStats,
  };

})();