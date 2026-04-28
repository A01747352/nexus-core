// ============================================================
//  NEXUS CORE — war.js v2
//  - Flujo único: Reg. War → Resultado en un solo paso
//  - Botón guardar se deshabilita tras guardar (evita duplicados)
//  - Confirmación de éxito antes de regresar al clan
//  - Funciones de borrado para miembros, guerras y donaciones
//  Depende de: auth.js, api.js, store.js
// ============================================================

const War = (() => {

  let _warState   = {};
  let _cwlState   = {};
  let _activeClan = '';
  let _saving     = false; // Bandera anti-doble-click

  // ── War Registration ──────────────────────────────────────

  function startWarReg(clanId) {
    _activeClan = clanId;
    _warState   = {};
    _saving     = false;
  }

  function toggleWarEntered(memberId) {
    if (!_warState[memberId]) _warState[memberId] = { entered: false, attacks: 0 };
    _warState[memberId].entered = !_warState[memberId].entered;
    if (!_warState[memberId].entered) _warState[memberId].attacks = 0;
    _renderWarRow(memberId);
  }

  function setWarAttacks(memberId, value) {
    if (!_warState[memberId]) _warState[memberId] = { entered: false, attacks: 0 };
    const current = _warState[memberId].attacks;
    _warState[memberId].attacks = current === value ? 0 : value;
    _renderWarRow(memberId);
  }

  function getWarState(memberId) {
    return _warState[memberId] || { entered: false, attacks: 0 };
  }

  // Guarda ataques + resultado en un solo flujo
  async function saveWarFull(warResult) {
    if (_saving) return;
    _saving = true;
    _disableSaveBtn('war-save-btn');

    const members = Store.getMembers(_activeClan);

    // 1. Acumular ataques por miembro
    const participants = [];
    members.forEach(m => {
      const s = _warState[m.id] || {};
      if (s.entered) {
        m.warTotal   = (m.warTotal   || 0) + 1;
        m.warAttacks = (m.warAttacks || 0) + (s.attacks || 0);
        participants.push(m.name);
      }
    });

    // 2. Guardar resultado con lista de participantes
    const war = {
      date:         warResult.date,
      type:         warResult.type,
      result:       warResult.result,
      starsUs:      warResult.starsUs   || '',
      starsThem:    warResult.starsThem || '',
      participants: participants.join(', '),
    };

    Store.setMembers(_activeClan, members);
    Store.addWar(_activeClan, war);
    Store.logActivity(`Guerra ${_resultLabel(war.result)} registrada`, _activeClan);
    _warState = {};

    try {
      await Promise.all([
        API.saveMembersWithLog(_activeClan, members, `Guerra registrada: ${_resultLabel(war.result)}`, Auth.getSession()?.name),
        API.saveWar(_activeClan, war),
      ]);
    } catch(e) {
      console.error('Error guardando guerra:', e);
    }

    _saving = false;
  }

  // ── CWL Registration ──────────────────────────────────────

  function startCWLReg(clanId) {
    _activeClan = clanId;
    _cwlState   = {};
    _saving     = false;
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
    if (_saving) return;
    _saving = true;
    _disableSaveBtn('cwl-save-btn');

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

    try {
      await API.saveMembersWithLog(_activeClan, members, 'Registro CWL', Auth.getSession()?.name);
    } catch(e) {
      console.error('Error guardando CWL:', e);
    }

    _saving = false;
  }

  // ── Borrar ────────────────────────────────────────────────

  async function deleteMember(clanId, memberId) {
    const members = Store.getMembers(clanId).filter(m => String(m.id) !== String(memberId));
    Store.setMembers(clanId, members);
    Store.logActivity('Miembro eliminado', clanId);
    try {
      await API.saveMembersWithLog(clanId, members, 'Miembro eliminado', Auth.getSession()?.name);
    } catch(e) {
      console.error('Error eliminando miembro:', e);
    }
  }

  async function deleteWar(clanId, warIndex) {
    const wars = Store.getWars(clanId).filter((_, i) => i !== warIndex);
    Store.setWars(clanId, wars);
    Store.logActivity('Guerra eliminada', clanId);
    try {
      await API.replaceWars(clanId, wars);
    } catch(e) {
      console.error('Error eliminando guerra:', e);
    }
  }

  async function moveMember(fromClanId, memberId, toClanId) {
    if (fromClanId === toClanId) return { ok: false, error: 'El clan destino es el mismo.' };

    const fromMembers = Store.getMembers(fromClanId);
    const member = fromMembers.find(m => String(m.id) === String(memberId));
    if (!member) return { ok: false, error: 'Miembro no encontrado.' };

    // Copiar al clan destino con el mismo id para evitar duplicados por tag
    const toMembers = Store.getMembers(toClanId);
    const alreadyThere = toMembers.find(m => m.tag === member.tag);
    if (alreadyThere) return { ok: false, error: `${member.name} ya existe en ese clan.` };

    // Agregar al destino conservando todos sus stats
    toMembers.push({ ...member, id: Date.now() });
    Store.setMembers(toClanId, toMembers);

    // Quitar del origen
    const newFrom = fromMembers.filter(m => String(m.id) !== String(memberId));
    Store.setMembers(fromClanId, newFrom);

    Store.logActivity(`${member.name} movido a ${toClanId}`, fromClanId);

    try {
      await Promise.all([
        API.saveMembersWithLog(fromClanId, newFrom, `Miembro movido: ${member.name}`, Auth.getSession()?.name),
        API.saveMembersWithLog(toClanId, toMembers, `Miembro recibido: ${member.name}`, Auth.getSession()?.name),
      ]);
    } catch(e) {
      console.error('Error moviendo miembro:', e);
    }

    return { ok: true, member };
  }

  async function resetDonations(clanId, memberId) {
    const members = Store.getMembers(clanId);
    const m = members.find(x => String(x.id) === String(memberId));
    if (!m) return;
    m.donTotal = 0;
    Store.setMembers(clanId, members);
    Store.logActivity('Donaciones reseteadas', clanId);
    try {
      await API.saveMembersWithLog(clanId, members, 'Donaciones reseteadas', Auth.getSession()?.name);
    } catch(e) {
      console.error('Error reseteando donaciones:', e);
    }
  }

  // ── UI Helpers ────────────────────────────────────────────

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
      if (el) {
        el.className = `ck-n ${(s.attacks || 0) >= n ? 'on' : ''}`;
        el.style.cssText = 'width:26px;height:26px;font-size:11px';
      }
    }
  }

  function _disableSaveBtn(id) {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando...';
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
    }
  }

  function _resultLabel(result) {
    return { win: 'Victoria', loss: 'Derrota', draw: 'Empate' }[result] || result;
  }

  function getResultLabel(result)     { return _resultLabel(result); }
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
    saveWarFull,
    // CWL
    startCWLReg,
    toggleCWLEntered,
    toggleCWLMirror,
    setCWLAttacks,
    getCWLState,
    saveCWLReg,
    // Borrar / Mover
    deleteMember,
    deleteWar,
    resetDonations,
    moveMember,
    // Utils
    getResultLabel,
    getResultBadgeClass,
  };

})();