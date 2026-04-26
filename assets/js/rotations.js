// ============================================================
//  NEXUS CORE — rotations.js
//  Registro de rotaciones Capital Raid entre clanes
//  Usa el tag de CoC como identificador único del jugador
//  Depende de: auth.js, api.js, store.js
// ============================================================

const Rotations = (() => {

  // ── Guardar rotación ──────────────────────────────────────
  async function saveRotation(formData) {
    const { date, tag, name, fromClan, toClan, donations } = formData;

    // Validaciones
    if (!name?.trim())   return { ok: false, error: 'El nombre es requerido.' };
    if (!tag?.trim())    return { ok: false, error: 'El tag de CoC es requerido.' };
    if (fromClan === toClan) return { ok: false, error: 'El clan de origen y destino no pueden ser el mismo.' };

    const cleanTag = _normalizeTag(tag);
    const don = Math.max(0, parseInt(donations) || 0);

    const rotation = {
      date:      date || new Date().toLocaleDateString('es-MX'),
      tag:       cleanTag,
      name:      name.trim(),
      from:      fromClan,
      to:        toClan,
      don,
    };

    // Sumar donaciones al miembro en su clan de origen usando el tag
    const found = Store.findMemberByTag(cleanTag);
    if (found) {
      found.member.donTotal = (found.member.donTotal || 0) + don;
      Store.setMembers(found.clanId, Store.getMembers(found.clanId));
    }

    Store.addRotation(rotation);
    Store.logActivity(`Rotación Capital Raid: ${name}`, fromClan);

    if (API.isConnected()) {
      const promises = [API.saveRotation(rotation)];
      // Si encontramos al miembro, actualizamos sus donaciones en Sheets
      if (found) {
        promises.push(
          API.saveMembersWithLog(
            found.clanId,
            Store.getMembers(found.clanId),
            `Donaciones rotación: ${name}`,
            Auth.getSession()?.name
          )
        );
      }
      await Promise.all(promises);
    }

    return { ok: true, memberFound: !!found };
  }

  // ── Stats de rotaciones ───────────────────────────────────

  // Rotaciones del fin de semana actual
  function getCurrentWeekendRotations() {
    const rotations = Store.getRotations();
    const now = new Date();
    const weekStart = _getWeekendStart(now);
    return rotations.filter(r => {
      const d = new Date(r.date);
      return d >= weekStart;
    });
  }

  // Historial completo ordenado por fecha desc
  function getAllRotations() {
    return [...Store.getRotations()].reverse();
  }

  // Rotaciones de un clan específico (como origen o destino)
  function getRotationsByClan(clanId) {
    return Store.getRotations().filter(r => r.from === clanId || r.to === clanId);
  }

  // Jugadores que más han rotado este mes
  function getTopRotators() {
    const rotations = Store.getRotations();
    const counts = {};
    rotations.forEach(r => {
      const key = r.tag;
      if (!counts[key]) counts[key] = { tag: r.tag, name: r.name, count: 0, totalDon: 0 };
      counts[key].count++;
      counts[key].totalDon += r.don || 0;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }

  // ── Utils ─────────────────────────────────────────────────

  // Normaliza el tag: mayúsculas y # al inicio
  function _normalizeTag(tag) {
    let clean = tag.trim().toUpperCase();
    if (!clean.startsWith('#')) clean = '#' + clean;
    return clean;
  }

  // Inicio del fin de semana actual (viernes 00:00)
  function _getWeekendStart(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=dom, 5=vie, 6=sab
    const diff = day >= 5 ? day - 5 : day + 2;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getClanName(clanId) {
    return Store.CLANS_META.find(c => c.id === clanId)?.name || clanId;
  }

  // ── API pública ───────────────────────────────────────────
  return {
    saveRotation,
    getCurrentWeekendRotations,
    getAllRotations,
    getRotationsByClan,
    getTopRotators,
    getClanName,
  };

})();