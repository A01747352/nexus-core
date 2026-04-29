// ============================================================
//  NEXUS CORE — coc-sync.js
//  Sincronización automática desde la API oficial de CoC
//  Consulta /api/coc (proxy Vercel) — la key nunca sale al browser
// ============================================================

const CocSync = (() => {

  const PROXY = '/api/coc';

  // ── Fetch helper ──────────────────────────────────────────
  async function cocCall(params) {
    const qs  = new URLSearchParams(params).toString();
    const res = await fetch(`${PROXY}?${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  // ── Sync completo de los 4 clanes ─────────────────────────
  // Llama a /api/coc?action=allclans y actualiza el Store
  async function syncAll() {
    const raw = await cocCall({ action: 'allclans' });

    Store.CLAN_IDS.forEach(clanId => {
      const clanData = raw[clanId];
      if (!clanData) return;

      // Sync miembros
      if (clanData.members?.items) {
        _syncMembers(clanId, clanData.members.items);
      }

      // Sync guerra activa
      if (clanData.currentWar && clanData.currentWar.state !== 'notInWar') {
        _syncWar(clanId, clanData.currentWar);
      }
    });

    Store.logActivity('Sync automático CoC', 'todos');
    return { ok: true };
  }

  // ── Sync miembros de un clan ──────────────────────────────
  // Preserva stats existentes (ataques, donaciones acumuladas)
  // Solo actualiza nombre, tag, rol y donaciones de la semana
  function _syncMembers(clanId, cocMembers) {
    const existing = Store.getMembers(clanId);

    const updated = cocMembers.map(cocM => {
      // Buscar por tag — identificador único
      const found = existing.find(m => m.tag === `#${cocM.tag}` || m.tag === cocM.tag);

      if (found) {
        // Miembro existente — actualizar solo campos de CoC
        return {
          ...found,
          name:     cocM.name,
          tag:      `#${cocM.tag}`.replace('##', '#'),
          role:     _mapRole(cocM.role),
          donWeek:  cocM.donations || 0,        // Donaciones de esta semana
          donRecv:  cocM.donationsReceived || 0, // Recibidas esta semana
        };
      } else {
        // Miembro nuevo — crear con stats en 0
        return {
          id:         Date.now() + Math.random(),
          name:       cocM.name,
          tag:        `#${cocM.tag}`.replace('##', '#'),
          role:       _mapRole(cocM.role),
          warTotal:   0,
          warAttacks: 0,
          cwlTotal:   0,
          cwlAtkTotal:0,
          cwlMirrors: 0,
          donTotal:   0,
          donWeek:    cocM.donations || 0,
          donRecv:    cocM.donationsReceived || 0,
        };
      }
    });

    // Detectar miembros que salieron del clan
    const updatedTags = updated.map(m => m.tag);
    const left = existing.filter(m => !updatedTags.includes(m.tag));
    if (left.length > 0) {
      console.log(`[CoC Sync] Salieron de ${clanId}:`, left.map(m => m.name).join(', '));
    }

    Store.setMembers(clanId, updated);
  }

  // ── Sync guerra activa ────────────────────────────────────
  // Si hay guerra activa con resultado, lo agrega al historial
  function _syncWar(clanId, war) {
    const state = war.state; // preparation, inWar, warEnded

    if (state === 'warEnded') {
      const existing = Store.getWars(clanId);
      const warDate  = war.endTime ? war.endTime.substring(0, 8) : new Date().toISOString().split('T')[0];

      // Evitar duplicados — no agregar si ya existe una guerra de esa fecha
      const alreadyLogged = existing.some(w => String(w.date).includes(warDate.substring(0, 6)));
      if (alreadyLogged) return;

      const clan    = war.clan;
      const opponent= war.opponent;
      let result    = 'draw';
      if (clan.stars > opponent.stars) result = 'win';
      else if (clan.stars < opponent.stars) result = 'loss';
      else if (clan.destructionPercentage > opponent.destructionPercentage) result = 'win';
      else if (clan.destructionPercentage < opponent.destructionPercentage) result = 'loss';

      Store.addWar(clanId, {
        date:      _formatDate(war.endTime),
        type:      'war',
        result,
        starsUs:   clan.stars,
        starsThem: opponent.stars,
        source:    'coc-api', // Marcar como auto-sync
      });

      // Sync ataques de los miembros en esta guerra
      if (clan.members) {
        _syncWarAttacks(clanId, clan.members);
      }
    }
  }

  // ── Sync ataques individuales de guerra ───────────────────
  function _syncWarAttacks(clanId, warMembers) {
    const members = Store.getMembers(clanId);
    let changed = false;

    warMembers.forEach(wm => {
      const m = members.find(x => x.tag === `#${wm.tag}` || x.tag === wm.tag);
      if (!m) return;
      const attacks = wm.attacks?.length || 0;
      if (attacks > 0) {
        m.warTotal   = (m.warTotal   || 0) + 1;
        m.warAttacks = (m.warAttacks || 0) + attacks;
        changed = true;
      }
    });

    if (changed) Store.setMembers(clanId, members);
  }

  // ── Sync donaciones semanales ─────────────────────────────
  // Actualiza donTotal sumando donWeek si cambió desde último sync
  async function syncDonations(clanId) {
    const tag   = _getClanTag(clanId);
    if (!tag) return;

    const data    = await cocCall({ action: 'members', tag });
    const members = Store.getMembers(clanId);

    data.items?.forEach(cocM => {
      const m = members.find(x => x.tag === `#${cocM.tag}` || x.tag === cocM.tag);
      if (!m) return;
      const newDon = cocM.donations || 0;
      // Si donWeek cambió, la diferencia son donaciones nuevas
      const prev = m.donWeek || 0;
      if (newDon > prev) {
        m.donTotal = (m.donTotal || 0) + (newDon - prev);
        m.donWeek  = newDon;
      }
    });

    Store.setMembers(clanId, members);

    if (API.isConnected()) {
      await API.saveMembersWithLog(clanId, members, 'Sync donaciones CoC', 'auto');
    }
  }

  // ── Push a Sheets después del sync ───────────────────────
  async function pushSyncToSheets() {
    if (!API.isConnected()) return;
    await Promise.all(
      Store.CLAN_IDS.map(id =>
        API.saveMembersWithLog(id, Store.getMembers(id), 'Sync automático CoC', 'auto')
      )
    );
  }

  // ── Utils ─────────────────────────────────────────────────
  function _mapRole(cocRole) {
    const map = {
      leader:      'Líder',
      coLeader:    'Colidér',
      admin:       'Colidér',
      member:      'Miembro',
    };
    return map[cocRole] || 'Miembro';
  }

  function _getClanTag(clanId) {
    const tags = {
      crushers:    '2RQYUQY0P',
      northwestern:'2GY2Q9GQ0',
      mexico:      '28Q9R0LRU',
      tranqui:     '2JQR92PRG',
    };
    return tags[clanId] || null;
  }

  function _formatDate(cocDateStr) {
    if (!cocDateStr) return new Date().toLocaleDateString('es-MX');
    // CoC format: 20260426T120000.000Z
    const y = cocDateStr.substring(0, 4);
    const m = cocDateStr.substring(4, 6);
    const d = cocDateStr.substring(6, 8);
    return `${y}-${m}-${d}`;
  }

  // ── Estado de guerra activa para mostrar en UI ─────────────
  async function getCurrentWar(clanId) {
    const tag = _getClanTag(clanId);
    if (!tag) return null;
    try {
      const data = await cocCall({ action: 'currentwar', tag });
      if (data.state === 'notInWar') return null;
      return data;
    } catch {
      return null;
    }
  }

  // ── API pública ───────────────────────────────────────────
  return {
    syncAll,
    syncDonations,
    pushSyncToSheets,
    getCurrentWar,
  };

})();