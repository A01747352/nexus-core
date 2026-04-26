// ============================================================
//  NEXUS CORE — war.js
//  Registro de participación en War y CWL
//  Depende de: auth.js, api.js, store.js
// ============================================================

const War = (() => {

  // ── Estado temporal del registro activo ───────────────────
  let _warState  = {}; // { [memberId]: { entered, attacks } }
  let _cwlState  = {}; // { [memberId]: { entered, mirror, attacks } }
  let _activeClan = '';
  let _activeType = 'war'; // 'war' | 'cwl'

  // ── War Registration ──────────────────────────────────────

  function startWarReg(clanId) {
    _activeClan = clanId;
    _activeType = 'war';
    _warState = {};
  }

  function toggleWarEntered(memberId) {
    if (!_warState[memberId]) _warState[memberId] = { entered: false, attacks: 0 };
    _warState[memberId].entered = !_warState[memberId].entered;
    // Si sale de la guerra, resetear ataques
    if (!_warState[memberId].entered) _warState[memberId].attacks = 0;
    _renderWarRow(memberId);
  }

  function setWarAttacks(memberId, value) {
    if (!_warState[memberId]) _warState[memberId] = { entered: false, attacks: 0 };
    const current = _warState[memberId].attacks;
    // Toggle: si ya tiene ese valor, lo quita
    _warState[memberId].attacks = current === value ? 0 : value;
    _renderWarRow(memberId);
  }

  function getWarState(memberId) {
    return _warState[memberId] || { entered: false, attacks: 0 };
  }

  async function saveWarReg() {
    const members = Store.getMembers(_activeClan);

    members.forEach(m => {
      const s = _warState[m.id] || {};
      if (s.entered) {
        m.warTotal    = (m.warTotal    || 0) + 1;
        m.warAttacks  = (m.warAttacks  || 0) + (s.attacks || 0);
      }
    });

    Store.setMembers(_activeClan, members);
    Store.logActivity('Registro War', _activeClan);
    _warState = {};

    if (API.isConnected()) {
      await API.saveMembersWithLog(
        _activeClan,
        members,
        'Registro War',
        Auth.getSession()?.name
      );
    }
  }

  // ── CWL Registration ──────────────────────────────────────

  function startCWLReg(clanId) {
    _activeClan = clanId;
    _activeType = 'cwl';
    _cwlState = {};
  }

  function toggleCWLEntered(memberId) {
    if (!_cwlState[memberId]) _cwlState[memberId] = { entered: false, mirror: false, attacks: 0 };
    _cwlState[memberId].entered = !_cwlState[memberId].entered;
    if (!_cwlState[memberId].entered) {
      _cwlState[memberId].mirror  = false;
      _cwlState[memberId].attacks = 0;
    }
    _renderCWLRow(memberId);
  }

  function toggleCWLMirror(memberId) {
    if (!_cwlState[memberId]) _cwlState[memberId] = { entered: false, mirror: false, attacks: 0 };
    _cwlState[memberId].mirror = !_cwlState[memberId].mirror;
    _renderCWLRow(memberId);
  }

  function setCWLAttacks(memberId, value) {
    if (!_cwlState[memberId]) _cwlState[memberId] = { entered: false, mirror: false, attacks: 0 };
    const current = _cwlState[memberId].attacks;
    _cwlState[memberId].attacks = current === value ? 0 : value;
    _renderCWLRow(memberId);
  }

  function getCWLState(memberId) {
    return _cwlState[memberId] || { entered: false, mirror: false, attacks: 0 };
  }

  async function saveCWLReg() {
    const members = Store.getMembers(_activeClan);

    members.forEach(m => {
      const s = _cwlState[m.id] || {};
      if (s.entered) {
        m.cwlTotal    = (m.cwlTotal    || 0) + 1;
        m.cwlAtkTotal = (m.cwlAtkTotal || 0) + (s.attacks || 0);
        m.cwlMirrors  = (m.cwlMirrors  || 0) + (s.mirror ? 1 : 0);
      }
    });

    Store.setMembers(_activeClan, members);
    Store.logActivity('Registro CWL', _activeClan);
    _cwlState = {};

    if (API.isConnected()) {
      await API.saveMembersWithLog(
        _activeClan,
        members,
        'Registro CWL',
        Auth.getSession()?.name
      );
    }
  }

  // ── Historial de guerras ───────────────────────────────────

  async function saveWarResult(clanId, warData) {
    const war = {
      date:      warData.date,
      type:      warData.type,     // 'war' | 'cwl'
      result:    warData.result,   // 'win' | 'loss' | 'draw'
      starsUs:   warData.starsUs   || '',
      starsThem: warData.starsThem || '',
    };

    Store.addWar(clanId, war);
    Store.logActivity(
      `Resultado ${war.type === 'cwl' ? 'CWL' : 'guerra'}: ${_resultLabel(war.result)}`,
      clanId
    );

    if (API.isConnected()) {
      await API.saveWar(clanId, war);
    }
  }

  // ── UI Render helpers ─────────────────────────────────────
  // Actualiza solo la fila del miembro sin re-renderizar toda la lista

  function _renderWarRow(memberId) {
    const s = _warState[memberId] || {};
    const eEl  = document.getElementById(`we-${memberId}`);
    const a1El = document.getElementById(`wa1-${memberId}`);
    const a2El = document.getElementById(`wa2-${memberId}`);
    if (eEl)  eEl.className  = `ck ${s.entered ? 'on' : ''}`;
    if (a1El) a1El.className = `ck-n ${(s.attacks || 0) >= 1 ? 'on' : ''}`;
    if (a2El) a2El.className = `ck-n ${(s.attacks || 0) >= 2 ? 'on' : ''}`;
  }

  function _renderCWLRow(memberId) {
    const s = _cwlState[memberId] || {};
    const eEl = document.getElementById(`ce-${memberId}`);
    const mEl = document.getElementById(`cm-${memberId}`);
    if (eEl) eEl.className = `ck ${s.entered ? 'on' : ''}`;
    if (mEl) mEl.className = `ck ${s.mirror  ? 'on' : ''}`;
    for (let n = 1; n <= 7; n++) {
      const el = document.getElementById(`ca${n}-${memberId}`);
      if (el) el.className = `ck-n ${(s.attacks || 0) >= n ? 'on' : ''}`;
    }
  }

  // ── Utils ─────────────────────────────────────────────────
  function _resultLabel(result) {
    return { win: 'Victoria', loss: 'Derrota', draw: 'Empate' }[result] || result;
  }

  function getResultLabel(result) {
    return _resultLabel(result);
  }

  function getResultBadgeClass(result) {
    return { win: 'b-green', loss: 'b-red', draw: 'b-amber' }[result] || 'b-gray';
  }

  // ── API pública ───────────────────────────────────────────
  return {
    // War
    startWarReg,
    toggleWarEntered,
    setWarAttacks,
    getWarState,
    saveWarReg,
    // CWL
    startCWLReg,
    toggleCWLEntered,
    toggleCWLMirror,
    setCWLAttacks,
    getCWLState,
    saveCWLReg,
    // Historial
    saveWarResult,
    // Utils
    getResultLabel,
    getResultBadgeClass,
  };

})();