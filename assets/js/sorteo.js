// ============================================================
//  NEXUS CORE — sorteo.js
//  Sorteo mensual de pases de oro
//  Solo ejecutable por el super líder
//  Depende de: auth.js, store.js
// ============================================================

const Sorteo = (() => {

  // ── Historial de sorteos ──────────────────────────────────
  let _history = []; // [ { date, winners: [...] } ]

  // ── Criterios de elegibilidad ─────────────────────────────
  const CRITERIA = {
    MIN_WARS: 6,             // mínimo de guerras jugadas en el mes
    MIN_WAR_COMPLETION: 0.7, // 70% de ataques realizados
    MIN_DONATIONS: 1000,
  };

  const PRIZES = [
    { label: '1er Pase de Oro', color: '#EF9F27', symbol: '★' },
    { label: '2do Pase de Oro', color: '#aaaaaa', symbol: '✦' },
    { label: '3er Pase de Oro', color: '#cd7f32', symbol: '◆' },
  ];

  // ── Elegibilidad ──────────────────────────────────────────

  function getEligible() {
    return Store.getAllEligible();
  }

  function getEligibleCount() {
    return getEligible().length;
  }

  // Razón por la que un miembro NO es apto (para mostrar en UI)
  function getIneligibleReason(member) {
    const reasons = [];
    const wars = member.warTotal || 0;
    if (wars < CRITERIA.MIN_WARS) {
      const missing = CRITERIA.MIN_WARS - wars;
      reasons.push(`Le faltan ${missing} guerra${missing > 1 ? 's' : ''} (mín. ${CRITERIA.MIN_WARS})`);
    } else {
      const completion = (member.warAttacks || 0) / (wars * 2);
      if (completion < CRITERIA.MIN_WAR_COMPLETION) {
        const missing = Math.ceil(wars * 2 * CRITERIA.MIN_WAR_COMPLETION) - (member.warAttacks || 0);
        reasons.push(`Le faltan ${missing} ataque${missing > 1 ? 's' : ''} en war (70%)`);
      }
    }
    if ((member.donTotal || 0) < CRITERIA.MIN_DONATIONS) {
      const missing = CRITERIA.MIN_DONATIONS - (member.donTotal || 0);
      reasons.push(`Le faltan ${missing} donaciones`);
    }
    return reasons.join(' · ');
  }

  // ── Ejecutar sorteo ───────────────────────────────────────

  function run() {
    // Solo el super líder puede ejecutar el sorteo
    if (!Auth.isSuper()) {
      return { ok: false, error: 'Solo el super líder puede realizar el sorteo.' };
    }

    const eligible = getEligible();

    if (eligible.length === 0) {
      return { ok: false, error: 'No hay miembros aptos para el sorteo.' };
    }
    if (eligible.length < 2) {
      return { ok: false, error: 'Se necesitan al menos 2 miembros aptos para el sorteo.' };
    }

    // Fisher-Yates shuffle para aleatoriedad real
    const pool = [...eligible];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const winners = pool.slice(0, Math.min(3, pool.length)).map((w, i) => ({
      ...w,
      prize: PRIZES[i],
      position: i + 1,
    }));

    const entry = {
      date: new Date().toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric'
      }),
      month: new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
      winners,
      totalEligible: eligible.length,
      drawnBy: Auth.getSession()?.name || '—',
    };

    _history.push(entry);
    Store.logActivity('Sorteo mensual realizado', 'todos');

    return { ok: true, result: entry };
  }

  // ── Historial ─────────────────────────────────────────────

  function getHistory() {
    return [..._history].reverse();
  }

  function getLastResult() {
    return _history.length ? _history[_history.length - 1] : null;
  }

  // ── Resumen del mes para el dashboard ─────────────────────

  function getMonthSummary() {
    const eligible   = getEligible();
    const lastResult = getLastResult();
    const now        = new Date();
    const daysLeft   = _daysUntilEndOfMonth(now);

    return {
      eligible:    eligible.length,
      prizes:      PRIZES.length,
      daysLeft,
      lastSorteo:  lastResult?.date || null,
      drawn:       !!lastResult,
    };
  }

  // ── Utils ─────────────────────────────────────────────────

  function _daysUntilEndOfMonth(date) {
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return end.getDate() - date.getDate();
  }

  function getPrizes() {
    return PRIZES;
  }

  function getCriteria() {
    return CRITERIA;
  }

  // ── API pública ───────────────────────────────────────────
  return {
    getEligible,
    getEligibleCount,
    getIneligibleReason,
    run,
    getHistory,
    getLastResult,
    getMonthSummary,
    getPrizes,
    getCriteria,
  };

})();