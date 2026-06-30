// ============================================================
//  NEXUS CORE — store.js
//  Estado global centralizado en memoria
//  Todos los módulos leen y escriben desde aquí
// ============================================================

const Store = (() => {

  // ── Estado inicial ────────────────────────────────────────
  const CLAN_IDS = ['crushers', 'northwestern', 'mexico', 'tranqui'];

  const CLANS_META = [
    { id: 'crushers',    name: 'The Crushers',  th: 'TH 16+', color: '#7F77DD', av: 0 },
    { id: 'northwestern',name: 'NorthWestern',  th: 'TH 13+', color: '#1D9E75', av: 1 },
    { id: 'mexico',      name: 'XxMEXICOxX',   th: 'TH 9+',  color: '#D85A30', av: 2 },
    { id: 'tranqui',     name: 'Algo Tranqui',  th: 'TH 7+',  color: '#378ADD', av: 3 },
  ];

  let _state = {
    clans: _buildEmptyClans(),
    rotations: [],
    activity: [],
    ui: {
      activePage: 'dashboard',
      activeClan: 'crushers',
      lightMode: false,
      sheetsConnected: false,
      lastSync: null,
    },
  };

  function _buildEmptyClans() {
    const obj = {};
    CLAN_IDS.forEach(id => { obj[id] = { members: [], wars: [] }; });
    return obj;
  }

  // ── Clanes ────────────────────────────────────────────────
  function getClan(id) {
    return _state.clans[id] || null;
  }

  function getMembers(clanId) {
    return _state.clans[clanId]?.members || [];
  }

  function setMembers(clanId, members) {
    if (!_state.clans[clanId]) return;
    _state.clans[clanId].members = members;
  }

  function getMember(clanId, memberId) {
    return getMembers(clanId).find(m => String(m.id) === String(memberId)) || null;
  }

  function updateMember(clanId, memberId, patch) {
    const members = getMembers(clanId);
    const idx = members.findIndex(m => String(m.id) === String(memberId));
    if (idx === -1) return false;
    members[idx] = { ...members[idx], ...patch };
    return true;
  }

  function addMember(clanId, member) {
    if (!_state.clans[clanId]) return;
    _state.clans[clanId].members.push({
      id: Date.now(),
      name: '',
      tag: '',
      role: 'Miembro',
      warTotal: 0,
      warAttacks: 0,
      cwlTotal: 0,
      cwlAtkTotal: 0,
      cwlMirrors: 0,
      donTotal: 0,
      ...member,
    });
  }

  // Busca un miembro por tag CoC en todos los clanes
  function findMemberByTag(tag) {
    for (const id of CLAN_IDS) {
      const m = getMembers(id).find(x => x.tag === tag);
      if (m) return { member: m, clanId: id };
    }
    return null;
  }

  // ── Guerras ───────────────────────────────────────────────
  function getWars(clanId) {
    return _state.clans[clanId]?.wars || [];
  }

  function addWar(clanId, war) {
    if (!_state.clans[clanId]) return;
    _state.clans[clanId].wars.push(war);
  }

  function setWars(clanId, wars) {
    if (!_state.clans[clanId]) return;
    _state.clans[clanId].wars = wars;
  }

  // ── Rotaciones ────────────────────────────────────────────
  function getRotations() {
    return _state.rotations;
  }

  function addRotation(rotation) {
    _state.rotations.push(rotation);
  }

  function setRotations(rotations) {
    _state.rotations = rotations;
  }

  // ── Actividad ─────────────────────────────────────────────
  function getActivity() {
    return _state.activity;
  }

  function logActivity(action, clan) {
    const session = Auth.getSession();
    _state.activity.push({
      action,
      clan,
      user: session?.name || '—',
      date: new Date().toLocaleDateString('es-MX'),
    });
  }

  // ── UI state ──────────────────────────────────────────────
  function getUI() {
    return _state.ui;
  }

  function setActivePage(page) {
    _state.ui.activePage = page;
  }

  function setActiveClan(clanId) {
    _state.ui.activeClan = clanId;
  }

  function setLightMode(val) {
    _state.ui.lightMode = val;
    document.body.classList.toggle('light', val);
  }

  function setSheetsConnected(val) {
    _state.ui.sheetsConnected = val;
  }

  function setLastSync(date) {
    _state.ui.lastSync = date;
  }

  // ── Hidratación desde Sheets ──────────────────────────────
  // Llama a esto después de API.getAll() para poblar el store
  function hydrate(sheetsData) {
    if (!sheetsData) return;

    CLAN_IDS.forEach(id => {
      if (sheetsData[id]) {
        _state.clans[id].members = sheetsData[id].members || [];
        _state.clans[id].wars    = sheetsData[id].wars    || [];
      }
    });

    if (sheetsData.rotations) _state.rotations = sheetsData.rotations;
    if (sheetsData.users)     Auth.setUsers(sheetsData.users);

    _state.ui.lastSync = new Date();
    _state.ui.sheetsConnected = true;
  }

  // ── Stats helpers ─────────────────────────────────────────
  // Verifica si un miembro cumple criterios para el sorteo
  function isEligible(member) {
    return (
      (member.warTotal || 0) >= 0 &&
      (member.warAttacks || 0) / ((member.warTotal || 0) * 2) >= 0.6 &&
      (member.donTotal || 0) >= 500
    );
  }

  // Devuelve todos los miembros aptos del sistema (todos los clanes)
  function getAllEligible() {
    const result = [];
    CLAN_IDS.forEach(id => {
      const meta = CLANS_META.find(c => c.id === id);
      getMembers(id).forEach(m => {
        if (isEligible(m)) result.push({ ...m, clanId: id, clanName: meta.name, av: meta.av });
      });
    });
    return result;
  }

  // Stats globales para el dashboard
  function getGlobalStats() {
    let totalMembers = 0, totalWars = 0, totalWins = 0, totalEligible = 0;
    CLAN_IDS.forEach(id => {
      const m = getMembers(id);
      const w = getWars(id);
      totalMembers  += m.length;
      totalWars     += w.length;
      totalWins     += w.filter(x => x.result === 'win').length;
      totalEligible += m.filter(isEligible).length;
    });
    return { totalMembers, totalWars, totalWins, totalEligible };
  }

  // Stats por clan
  function getClanStats(clanId) {
    const members = getMembers(clanId);
    const wars    = getWars(clanId);
    const wins    = wars.filter(w => w.result === 'win').length;
    const avgDon  = members.length
      ? Math.round(members.reduce((s, m) => s + (m.donTotal || 0), 0) / members.length)
      : 0;
    const eligible = members.filter(isEligible).length;
    return { members: members.length, wars: wars.length, wins, avgDon, eligible };
  }

  // ── API pública ───────────────────────────────────────────
  return {
    // Meta
    CLAN_IDS,
    CLANS_META,
    // Miembros
    getClan,
    getMembers,
    setMembers,
    getMember,
    updateMember,
    addMember,
    findMemberByTag,
    // Guerras
    getWars,
    addWar,
    setWars,
    // Rotaciones
    getRotations,
    addRotation,
    setRotations,
    // Actividad
    getActivity,
    logActivity,
    // UI
    getUI,
    setActivePage,
    setActiveClan,
    setLightMode,
    setSheetsConnected,
    setLastSync,
    // Hidratación
    hydrate,
    // Stats
    isEligible,
    getAllEligible,
    getGlobalStats,
    getClanStats,
  };

})();