// ============================================================
//  NEXUS CORE — app.js
//  Orquestación principal, renderizado UI y navegación
//  Depende de: auth.js, api.js, store.js, war.js,
//              donations.js, rotations.js, sorteo.js
// ============================================================

const App = (() => {

  // ── Init ──────────────────────────────────────────────────
  function init() {
    _bindLoginForm();
    _setDate();
  }


  // ── Toast de éxito ────────────────────────────────────────
  function showToast(msg) {
    let toast = document.getElementById('nc-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'nc-toast';
      toast.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        background:#1D9E75;color:white;padding:10px 20px;border-radius:8px;
        font-family:var(--font);font-size:14px;font-weight:500;z-index:999;
        box-shadow:0 4px 16px rgba(0,0,0,.3);transition:opacity .3s;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.style.display = 'none', 300);
    }, 2500);
  }

  // ── Login ─────────────────────────────────────────────────
  function _bindLoginForm() {
    document.getElementById('l-pass')
      .addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  }

  function login() {
    const user = document.getElementById('l-user').value;
    const pass = document.getElementById('l-pass').value;
    const res  = Auth.login(user, pass);

    if (!res.ok) {
      document.getElementById('login-err').style.display = 'block';
      return;
    }

    document.getElementById('login-screen').style.display  = 'none';
    document.getElementById('app-shell').style.display     = 'block';
    document.getElementById('w-name').textContent          = res.session.name;
    document.getElementById('login-err').style.display     = 'none';

    _buildNav();
    syncAll(); // Auto-sync al entrar
    goPage('dashboard');
  }

  function logout() {
    Auth.logout();
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display    = 'none';
    document.getElementById('l-user').value = '';
    document.getElementById('l-pass').value = '';
  }

  // ── Navigation ────────────────────────────────────────────
  function _buildNav() {
    document.getElementById('clan-nav').innerHTML = Store.CLANS_META.map(c => `
      <div class="nav-item" id="nav-clan-${c.id}" onclick="App.goPage('clan','${c.id}')">
        <div class="clan-dot" style="background:${c.color}"></div>
        ${c.name}
      </div>`).join('');

    _populateClanSelects();
  }

  function _populateClanSelects() {
    const opts = Store.CLANS_META.map(c =>
      `<option value="${c.id}">${c.name}</option>`).join('');
    ['rot-from', 'rot-to'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = opts;
    });
  }

  function goPage(page, clanId) {
    if (clanId) Store.setActiveClan(clanId);
    Store.setActivePage(page);

    // Nav active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navMap = {
      dashboard: 'nav-dashboard', rotaciones: 'nav-rotaciones',
      sorteo: 'nav-sorteo', config: 'nav-config',
    };
    if (navMap[page]) {
      document.getElementById(navMap[page])?.classList.add('active');
    } else if (page === 'clan') {
      document.getElementById(`nav-clan-${Store.getUI().activeClan}`)?.classList.add('active');
    }

    // Page visibility
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');
    document.getElementById('sidebar')?.classList.remove('open');

    _render(page);
  }

  function _render(page) {
    const renders = {
      dashboard:  renderDashboard,
      clan:       renderClan,
      war:        renderWarPage,
      cwl:        renderCWLPage,
      don:        renderDonPage,
      rotaciones: renderRotaciones,
      sorteo:     renderSorteo,
      config:     renderConfig,
    };
    renders[page]?.();
  }

  function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
  }

  function toggleTheme() {
    Store.setLightMode(!Store.getUI().lightMode);
  }

  // ── Sheets sync ───────────────────────────────────────────
  function connectSheets() {
    const url = document.getElementById('sheets-url').value.trim();
    const validation = API.validateUrl(url);
    if (!validation.ok) { showSync(validation.error, 'err'); return; }
    API.setUrl(url);
    syncAll();
  }

  async function syncAll() {

    const icon = document.getElementById('sync-icon');
    icon?.classList.add('spin');
    showSync('Sincronizando...', 'loading');

    try {
      const data = await API.getAll();
      Store.hydrate(data);
      const t = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      showSync(`Sync · ${t}`, 'ok');
    } catch (err) {
      showSync(`Error: ${err.message}`, 'err');
    }

    icon?.classList.remove('spin');
    _render(Store.getUI().activePage);
  }

  function showSync(msg, type) {
    const el = document.getElementById('sync-text');
    if (!el) return;
    el.textContent = msg;
    el.className = `sync-text sync-${type}`;
    if (type === 'ok') setTimeout(() => { el.className = 'sync-text'; }, 3000);
  }

  // ── Dashboard ─────────────────────────────────────────────
  function renderDashboard() {
    _setDate();
    const stats = Store.getGlobalStats();
    const winRate = stats.totalWars
      ? Math.round(stats.totalWins / stats.totalWars * 100) : 0;

    document.getElementById('global-stats').innerHTML = `
      <div class="stat-card hi">
        <div class="s-lbl">Miembros totales</div>
        <div class="s-val accent">${stats.totalMembers}</div>
        <div class="s-meta">en los 4 clanes</div>
      </div>
      <div class="stat-card">
        <div class="s-lbl">Guerras jugadas</div>
        <div class="s-val">${stats.totalWars}</div>
        <div class="s-meta"><span class="up">${stats.totalWins} victorias</span></div>
      </div>
      <div class="stat-card">
        <div class="s-lbl">Tasa de victorias</div>
        <div class="s-val">${winRate}%</div>
        <div class="prog"><div class="prog-bar g" style="width:${winRate}%"></div></div>
      </div>
      <div class="stat-card">
        <div class="s-lbl">Aptos sorteo</div>
        <div class="s-val">${stats.totalEligible}</div>
        <div class="s-meta">cumplen criterios</div>
      </div>`;

    document.getElementById('clan-cards').innerHTML = Store.CLANS_META.map(c => {
      const s = Store.getClanStats(c.id);
      return `
        <div class="clan-ov" onclick="App.goPage('clan','${c.id}')">
          <div class="clan-stripe" style="background:${c.color}"></div>
          <div class="clan-ov-inner">
            <div class="clan-ov-name">${c.name}</div>
            <div class="clan-ov-th">${c.th}</div>
            <div class="clan-ov-nums">
              <div class="co-num"><div class="co-val">${s.members}</div><div class="co-lbl">Miembros</div></div>
              <div class="co-num"><div class="co-val">${s.wars}</div><div class="co-lbl">Guerras</div></div>
              <div class="co-num"><div class="co-val">${s.wins}</div><div class="co-lbl">Victorias</div></div>
              <div class="co-num"><div class="co-val">${s.eligible}</div><div class="co-lbl">Aptos</div></div>
            </div>
          </div>
        </div>`;
    }).join('');

    const acts = Store.getActivity().slice(-6).reverse();
    document.getElementById('activity-list').innerHTML = acts.length
      ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Acción</th><th>Clan</th><th>Usuario</th><th>Fecha</th></tr></thead>
          <tbody>${acts.map(a => `
            <tr>
              <td class="n">${a.action}</td>
              <td><span class="badge b-gray">${a.clan}</span></td>
              <td>${a.user}</td>
              <td><span class="tag">${a.date}</span></td>
            </tr>`).join('')}
          </tbody>
        </table></div>`
      : '<div class="empty">Los cambios del sistema aparecerán aquí.</div>';

    document.getElementById('dash-actions').innerHTML = Auth.isSuper()
      ? '<button class="btn btn-primary btn-sm" onclick="App.goPage(\'sorteo\')">Sorteo del mes</button>'
      : '';
  }

  // ── Clan Page ─────────────────────────────────────────────
  function renderClan() {
    const clanId = Store.getUI().activeClan;
    const meta   = Store.CLANS_META.find(c => c.id === clanId);
    const stats  = Store.getClanStats(clanId);
    const wars   = Store.getWars(clanId);
    const members = Store.getMembers(clanId);
    const canEd  = Auth.canEdit(clanId);

    document.getElementById('clan-title').textContent = meta.name;
    document.getElementById('clan-sub').textContent =
      `${meta.th} · ${members.length} miembros`;

    document.getElementById('clan-stats').innerHTML = `
      <div class="stat-card">
        <div class="s-lbl">Miembros</div>
        <div class="s-val">${stats.members}</div>
      </div>
      <div class="stat-card">
        <div class="s-lbl">Guerras</div>
        <div class="s-val">${stats.wars}</div>
        <div class="s-meta"><span class="up">${stats.wins} victorias</span></div>
      </div>
      <div class="stat-card">
        <div class="s-lbl">Don. promedio</div>
        <div class="s-val">${stats.avgDon}</div>
      </div>`;

    document.getElementById('clan-actions').innerHTML = canEd ? `
      <button class="btn btn-primary btn-sm" onclick="App.goPage('war')">⚔️ Reg. War</button>
      <button class="btn btn-sm" onclick="App.goPage('cwl')">Reg. CWL</button>
      <button class="btn btn-sm" onclick="App.goPage('don')">Donaciones</button>
      <button class="btn btn-sm" onclick="App.openModal('modal-member')">+ Miembro</button>`
      : '<span class="readonly-notice">Solo lectura</span>';

    // Wars table
    const lbl = War.getResultLabel.bind(War);
    const bc  = War.getResultBadgeClass.bind(War);
    document.getElementById('clan-wars-card').innerHTML = `
      <div class="card-hd">
        <span class="card-title">Historial de resultados</span>
        <span class="badge b-purple">${wars.length} total</span>
      </div>
      ${!wars.length
        ? '<div class="empty">Sin guerras registradas.</div>'
        : `<div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Tipo</th><th>Fecha</th><th>Estrellas</th><th>Resultado</th><th></th></tr></thead>
            <tbody>${[...wars].reverse().slice(0, 8).map((w, i) => `
              <tr>
                <td class="n">${w.type === 'cwl' ? 'CWL' : 'Guerra'}</td>
                <td><span class="tag">${w.date || '—'}</span></td>
                <td>${w.starsUs || '—'} — ${w.starsThem || '—'}</td>
                <td><span class="badge ${bc(w.result)}">${lbl(w.result)}</span></td>
              ${canEd ? `<td><button class="btn btn-sm" style="color:var(--danger-light);border-color:var(--danger-bg);padding:3px 8px;font-size:11px" onclick="App.confirmDeleteWar('${clanId}',${i})">Borrar</button></td>` : '<td></td>'}
              </tr>`).join('')}
            </tbody>
          </table></div>`}`;

    // Members table
    document.getElementById('clan-members-card').innerHTML = `
      <div class="card-hd">
        <span class="card-title">Miembros</span>
        <span class="badge b-gray">${members.length}</span>
      </div>
      ${!members.length
        ? '<div class="empty">Sin miembros. Agrega con el botón + Miembro.</div>'
        : `<div class="tbl-wrap"><table class="tbl">
            <thead><tr>
              <th>Jugador</th><th>Tag</th><th>Rol</th>
              <th>Atq. War</th><th>Atq. CWL</th><th>Espejos</th>
              <th>Donaciones</th><th>Estado</th>
            </tr></thead>
            <tbody>${members.map(m => {
              const pct = m.warTotal > 0
                ? Math.round((m.warAttacks || 0) / (m.warTotal) * 100) : 0;
              const ok  = Store.isEligible(m);
              return `
                <tr>
                  <td class="n">
                    <div class="fl-row">
                      <div class="av av${meta.av}">${m.name.slice(0, 2).toUpperCase()}</div>
                      ${m.name}
                    </div>
                  </td>
                  <td><span class="tag">${m.tag || '—'}</span></td>
                  <td>${m.role || 'Miembro'}</td>
                  <td>
                    ${m.warAttacks || 0}/${(m.warTotal || 0) * 2}
                    <div class="prog" style="min-width:50px">
                      <div class="prog-bar ${pct >= 100 ? 'g' : ''}"
                           style="width:${Math.min(pct, 100)}%"></div>
                    </div>
                  </td>
                  <td>${m.cwlAtkTotal || 0}/${(m.cwlTotal || 0) * 7}</td>
                  <td>${m.cwlMirrors || 0}</td>
                  <td>
                    ${m.donTotal || 0}
                    ${(m.donTotal || 0) >= 1000
                      ? '<span style="color:#EF9F27;font-size:13px">★</span>' : ''}
                  </td>
                  <td><span class="badge ${ok ? 'b-green' : 'b-amber'}">${ok ? 'Apto' : 'Pendiente'}</span></td>
                  ${canEd ? `<td><button class="btn btn-sm" style="color:var(--danger-light);border-color:var(--danger-bg);padding:3px 8px;font-size:11px" onclick="App.confirmDeleteMember('${clanId}','${m.id}')">Borrar</button></td>` : '<td></td>'}
                </tr>`;
            }).join('')}
            </tbody>
          </table></div>`}`;
  }

  // ── War Page ──────────────────────────────────────────────
  function renderWarPage() {
    const clanId = Store.getUI().activeClan;
    const meta   = Store.CLANS_META.find(c => c.id === clanId);
    const members = Store.getMembers(clanId);

    War.startWarReg(clanId);

    document.getElementById('war-page-title').textContent = `Registro War — ${meta.name}`;
    document.getElementById('war-page-sub').textContent   = 'Marca ataques y resultado en un solo paso';
    document.getElementById('war-page-actions').innerHTML =
      '<button id="war-save-btn" class="btn btn-primary btn-sm" onclick="App.saveWarFull()">Guardar todo</button>';

    document.getElementById('war-reg-body').innerHTML = !members.length
      ? '<div class="card"><div class="empty">Sin miembros en este clan.</div></div>'
      : `<div class="card">
          <div class="card-hd">
            <span class="card-title">Participación en guerra</span>
            <span class="badge b-purple">Guerra regular</span>
          </div>
          <div class="fl-row" style="padding-bottom:10px;border-bottom:1px solid var(--border)">
            <div class="fl-1" style="font-size:11px;color:var(--text3)">Miembro</div>
            <div style="width:36px;font-size:10px;color:var(--text3);text-align:center">Entró</div>
            <div style="width:36px;font-size:10px;color:var(--text3);text-align:center">1 atq</div>
            <div style="width:36px;font-size:10px;color:var(--text3);text-align:center">2 atq</div>
          </div>
          ${members.map(m => `
            <div class="gap-row">
              <div class="fl-1">
                <div style="font-size:13px;font-weight:500;color:var(--text)">${m.name}</div>
                <span class="tag">${m.tag || '—'}</span>
              </div>
              <div id="we-${m.id}" class="ck" onclick="War.toggleWarEntered('${m.id}')">
                <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div id="wa1-${m.id}" class="ck-n" onclick="War.setWarAttacks('${m.id}',1)">1</div>
              <div id="wa2-${m.id}" class="ck-n" onclick="War.setWarAttacks('${m.id}',2)">2</div>
            </div>`).join('')}
        </div>
        <div class="card" style="margin-top:12px">
          <div class="card-hd"><span class="card-title">Resultado de la guerra</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px">
            <div class="fg">
              <label class="fl">Fecha</label>
              <input class="fi" type="date" id="war-res-date">
            </div>
            <div class="fg">
              <label class="fl">Tipo</label>
              <select class="fi" id="war-res-type">
                <option value="war">Guerra regular</option>
                <option value="cwl">CWL</option>
              </select>
            </div>
            <div class="fg" style="grid-column:1/-1">
              <label class="fl">Resultado</label>
              <select class="fi" id="war-res-result">
                <option value="win">Victoria ⚔️</option>
                <option value="loss">Derrota 💀</option>
                <option value="draw">Empate 🤝</option>
              </select>
            </div>
            <div class="fg">
              <label class="fl">Estrellas (nosotros)</label>
              <input class="fi" type="number" id="war-res-us" placeholder="ej. 28" min="0">
            </div>
            <div class="fg">
              <label class="fl">Estrellas (rivales)</label>
              <input class="fi" type="number" id="war-res-them" placeholder="ej. 20" min="0">
            </div>
          </div>
        </div>`;

    // Set today's date
    const dateEl = document.getElementById('war-res-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
  }

  async function saveWarFull() {
    const result = {
      date:      document.getElementById('war-res-date')?.value || new Date().toISOString().split('T')[0],
      type:      document.getElementById('war-res-type')?.value || 'war',
      result:    document.getElementById('war-res-result')?.value || 'win',
      starsUs:   document.getElementById('war-res-us')?.value || '',
      starsThem: document.getElementById('war-res-them')?.value || '',
    };
    await War.saveWarFull(result);
    showToast('✓ Guerra guardada correctamente');
    setTimeout(() => goPage('clan'), 2000);
  }

  async function saveWarReg() {
    await War.saveWarFull({ date: new Date().toISOString().split('T')[0], type: 'war', result: 'win' });
    showToast('✓ Registro guardado');
    setTimeout(() => goPage('clan'), 2000);
  }

  // ── CWL Page ──────────────────────────────────────────────
  function renderCWLPage() {
    const clanId  = Store.getUI().activeClan;
    const meta    = Store.CLANS_META.find(c => c.id === clanId);
    const members = Store.getMembers(clanId);

    War.startCWLReg(clanId);

    document.getElementById('cwl-page-title').textContent = `Registro CWL — ${meta.name}`;
    document.getElementById('cwl-page-sub').textContent   = 'Meta: 8+ estrellas por miembro en 7 días';
    document.getElementById('cwl-page-actions').innerHTML =
      '<button class="btn btn-primary btn-sm" onclick="App.saveCWLReg()">Guardar</button>';

    document.getElementById('cwl-reg-body').innerHTML = !members.length
      ? '<div class="card"><div class="empty">Sin miembros.</div></div>'
      : `<div class="card">
          <div class="card-hd">
            <span class="card-title">Participación CWL</span>
            <span class="badge b-purple">Liga de Clanes</span>
          </div>
          <p class="section-hint" style="margin-bottom:14px">
            Marca si entró, si atacó a su espejo y cuántos ataques totales realizó (1–7).
          </p>
          ${members.map(m => `
            <div style="padding:12px 0;border-bottom:1px solid var(--border)">
              <div class="fl-row" style="margin-bottom:8px">
                <div class="av av${meta.av}">${m.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style="font-size:13px;font-weight:500;color:var(--text)">${m.name}</div>
                  <span class="tag">${m.tag || '—'}</span>
                </div>
              </div>
              <div class="fl-row" style="gap:6px;flex-wrap:wrap">
                <div id="ce-${m.id}" class="ck" onclick="War.toggleCWLEntered('${m.id}')" title="Entró a CWL">
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div id="cm-${m.id}" class="ck" onclick="War.toggleCWLMirror('${m.id}')" title="Atacó espejo">
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <polyline points="19 12 12 5 5 12"/>
                  </svg>
                </div>
                <div style="width:1px;height:24px;background:var(--border);margin:0 2px"></div>
                ${[1,2,3,4,5,6,7].map(n => `
                  <div id="ca${n}-${m.id}" class="ck-n"
                       style="width:26px;height:26px;font-size:11px"
                       onclick="War.setCWLAttacks('${m.id}',${n})">${n}</div>
                `).join('')}
              </div>
            </div>`).join('')}
        </div>`;
  }

  async function saveCWLReg() {
    await War.saveCWLReg();
    showToast('✓ CWL guardada correctamente');
    setTimeout(() => goPage('clan'), 2000);
  }

  // ── Donations Page ────────────────────────────────────────
  function renderDonPage() {
    const clanId  = Store.getUI().activeClan;
    const meta    = Store.CLANS_META.find(c => c.id === clanId);
    const members = Store.getMembers(clanId);
    const week    = Donations.getCurrentWeek();

    Donations.startReg(clanId);

    document.getElementById('don-page-title').textContent = `Donaciones — ${meta.name}`;
    document.getElementById('don-page-sub').textContent   = week.label;
    document.getElementById('don-page-actions').innerHTML =
      '<button class="btn btn-primary btn-sm" onclick="App.saveDonReg()">Guardar semana</button>';

    document.getElementById('don-reg-body').innerHTML = !members.length
      ? '<div class="card"><div class="empty">Sin miembros.</div></div>'
      : `<div class="card">
          <div class="card-hd">
            <span class="card-title">Registro semanal</span>
            <span class="badge b-gray">★ = 1000+ donaciones totales</span>
          </div>
          ${members.map(m => `
            <div class="gap-row">
              <div class="av av${meta.av}">${m.name.slice(0, 2).toUpperCase()}</div>
              <div class="fl-1">
                <div style="font-size:13px;font-weight:500;color:var(--text)">${m.name}</div>
                <div style="font-size:12px;color:var(--text3)">Total: ${m.donTotal || 0}</div>
              </div>
              <input type="number" min="0" value="0" id="d-${m.id}"
                style="width:80px;padding:7px 10px;border:1px solid var(--border);
                       border-radius:var(--r);background:var(--surface2);color:var(--text);
                       font-family:var(--font);font-size:14px;text-align:center"
                oninput="Donations.setDonation('${m.id}', this.value)">
              <div id="dstar-${m.id}"
                   style="font-size:18px;min-width:20px;text-align:center;
                          color:${(m.donTotal || 0) >= 1000 ? '#EF9F27' : 'var(--text3)'}">★</div>
            </div>`).join('')}
        </div>`;
  }

  async function saveDonReg() {
    const res = await Donations.saveWeek();
    if (!res.ok) { alert(res.message); return; }
    showToast('✓ Donaciones guardadas');
    setTimeout(() => goPage('clan'), 2000);
  }

  // ── Rotaciones Page ───────────────────────────────────────
  function renderRotaciones() {
    const all = Rotations.getAllRotations();
    document.getElementById('rot-list').innerHTML = !all.length
      ? '<div class="empty">Sin rotaciones registradas.</div>'
      : `<div class="tbl-wrap"><table class="tbl">
          <thead><tr>
            <th>Jugador</th><th>Tag CoC</th><th>Origen</th>
            <th>Visitó</th><th>Donaciones</th><th>Fecha</th>
          </tr></thead>
          <tbody>${all.map(r => `
            <tr>
              <td class="n">${r.name}</td>
              <td><span class="tag">${r.tag}</span></td>
              <td><span class="badge b-gray">${Rotations.getClanName(r.from)}</span></td>
              <td><span class="badge b-purple">${Rotations.getClanName(r.to)}</span></td>
              <td>${r.don || 0}${(r.don || 0) >= 1000
                ? ' <span style="color:#EF9F27">★</span>' : ''}</td>
              <td><span class="tag">${r.date || '—'}</span></td>
            </tr>`).join('')}
          </tbody>
        </table></div>`;
  }

  async function saveRotation() {
    const res = await Rotations.saveRotation({
      date:      document.getElementById('rot-date').value,
      tag:       document.getElementById('rot-tag').value,
      name:      document.getElementById('rot-name').value,
      fromClan:  document.getElementById('rot-from').value,
      toClan:    document.getElementById('rot-to').value,
      donations: document.getElementById('rot-don').value,
    });

    if (!res.ok) { alert(res.error); return; }

    if (!res.memberFound) {
      alert('Rotación guardada. Nota: no se encontró al jugador por tag en ningún clan — verifica que el tag sea correcto.');
    }

    closeModal('modal-rot');
    renderRotaciones();
  }

  // ── Sorteo Page ───────────────────────────────────────────
  function renderSorteo() {
    const eligible = Sorteo.getEligible();
    const summary  = Sorteo.getMonthSummary();

    document.getElementById('sorteo-count-badge').textContent = `${eligible.length} aptos`;

    document.getElementById('sorteo-eligible').innerHTML = !eligible.length
      ? '<div class="empty">Sin miembros aptos todavía.</div>'
      : `<div class="tbl-wrap"><table class="tbl">
          <thead><tr>
            <th>Jugador</th><th>Tag</th><th>Clan</th>
            <th>Atq. War</th><th>Donaciones</th><th>Estado</th>
          </tr></thead>
          <tbody>${eligible.map(m => `
            <tr>
              <td class="n">
                <div class="fl-row">
                  <div class="av av${m.av}">${m.name.slice(0, 2).toUpperCase()}</div>
                  ${m.name}
                </div>
              </td>
              <td><span class="tag">${m.tag || '—'}</span></td>
              <td><span class="badge b-gray">${m.clanName}</span></td>
              <td>${m.warAttacks || 0}/${(m.warTotal || 0) * 2}</td>
              <td>${m.donTotal || 0}</td>
              <td><span class="badge b-green">Apto</span></td>
            </tr>`).join('')}
          </tbody>
        </table></div>`;

    document.getElementById('sorteo-btn-area').innerHTML = Auth.isSuper()
      ? `<button class="btn btn-primary" onclick="App.runSorteo()">
           Realizar sorteo del mes
         </button>`
      : '<span class="readonly-notice">Solo el super líder puede realizar el sorteo.</span>';
  }

  function runSorteo() {
    const res = Sorteo.run();
    if (!res.ok) { alert(res.error); return; }

    const { winners, date, drawnBy } = res.result;
    document.getElementById('sorteo-winners').innerHTML = winners.map(w => `
      <div class="fl-row" style="padding:12px 0;border-bottom:1px solid var(--border);gap:12px">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--surface2);
                    border:2px solid ${w.prize.color};display:flex;align-items:center;
                    justify-content:center;font-size:15px;font-weight:700;
                    color:${w.prize.color};flex-shrink:0">${w.position}</div>
        <div class="av av${w.av}">${w.name.slice(0, 2).toUpperCase()}</div>
        <div class="fl-1">
          <div style="font-size:14px;font-weight:600;color:var(--text)">${w.name}</div>
          <div style="font-size:12px;color:var(--text2)">${w.clanName} · ${w.prize.label}</div>
        </div>
        <span class="badge b-gold">Ganador</span>
      </div>`).join('');

    document.getElementById('sorteo-result').style.display = 'block';
    document.getElementById('sorteo-result').scrollIntoView({ behavior: 'smooth' });
  }

  // ── Config Page ───────────────────────────────────────────
  function renderConfig() {
    // Sheets setup siempre oculto — la URL vive en Vercel env
    const setupCard = document.getElementById('sheets-setup-card');
    if (setupCard) setupCard.style.display = 'none';

    document.getElementById('users-table').innerHTML = `
      <table class="tbl">
        <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Clan asignado</th></tr></thead>
        <tbody>${Auth.getUsers().map(u => `
          <tr>
            <td><code>${u.user}</code></td>
            <td class="n">${u.name}</td>
            <td><span class="badge ${u.role === 'super' ? 'b-gold' : 'b-purple'}">
              ${u.role === 'super' ? 'Super Líder' : 'Líder'}
            </span></td>
            <td>${u.clan
              ? Store.CLANS_META.find(c => c.id === u.clan)?.name || u.clan
              : 'Todos los clanes'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }


  // ── Borrar ────────────────────────────────────────────────
  function confirmDeleteMember(clanId, memberId) {
    const m = Store.getMember(clanId, memberId);
    if (!m) return;
    if (!confirm(`¿Borrar a ${m.name} del clan? Esta acción no se puede deshacer.`)) return;
    Store.setMembers(clanId, Store.getMembers(clanId).filter(m => String(m.id) !== String(memberId)));
    renderClan();
    showToast('✓ Miembro eliminado');
    War.deleteMember(clanId, memberId);
  }

  function confirmDeleteWar(clanId, warDisplayIndex) {
    // warDisplayIndex es el índice en el array revertido — convertir al real
    const wars = Store.getWars(clanId);
    const realIndex = wars.length - 1 - warDisplayIndex;
    if (!confirm('¿Borrar este resultado de guerra? Esta acción no se puede deshacer.')) return;
    const newWars = Store.getWars(clanId).filter((_, i) => i !== realIndex);
    Store.setWars(clanId, newWars);
    renderClan();
    showToast('✓ Guerra eliminada');
    War.deleteWar(clanId, realIndex);
  }

  function confirmResetDonations(clanId, memberId) {
    const m = Store.getMember(clanId, memberId);
    if (!m) return;
    if (!confirm(`¿Resetear las donaciones de ${m.name} a 0?`)) return;
    const mDon = Store.getMember(clanId, memberId);
    if (mDon) { mDon.donTotal = 0; Store.setMembers(clanId, Store.getMembers(clanId)); }
    renderClan();
    showToast('✓ Donaciones reseteadas');
    War.resetDonations(clanId, memberId);
  }

  // ── Members modal ─────────────────────────────────────────
  async function addMember() {
    const name = document.getElementById('nm-name').value.trim();
    if (!name) { alert('El nombre es requerido.'); return; }

    const tag  = document.getElementById('nm-tag').value.trim().toUpperCase();
    const role = document.getElementById('nm-role').value;
    const clanId = Store.getUI().activeClan;

    Store.addMember(clanId, { name, tag: tag || '—', role });
    Store.logActivity(`Nuevo miembro: ${name}`, clanId);

    await API.saveMembersWithLog(
      clanId,
      Store.getMembers(clanId),
      `Nuevo miembro: ${name}`,
      Auth.getSession()?.name
    );

    closeModal('modal-member');
    renderClan();
  }

  // ── War result modal ──────────────────────────────────────
  async function saveWarResult() {
    const clanId = Store.getUI().activeClan;
    await War.saveWarResult(clanId, {
      date:      document.getElementById('wh-date').value,
      type:      document.getElementById('wh-type').value,
      result:    document.getElementById('wh-result').value,
      starsUs:   document.getElementById('wh-us').value,
      starsThem: document.getElementById('wh-them').value,
    });
    closeModal('modal-war-hist');
    renderClan();
  }

  // ── Modals ────────────────────────────────────────────────
  function openModal(id) {
    if (id === 'modal-war-hist') {
      document.getElementById('wh-date').value = new Date().toISOString().split('T')[0];
      const name = Store.CLANS_META.find(c => c.id === Store.getUI().activeClan)?.name;
      document.getElementById('modal-war-hist-sub').textContent = name;
    }
    if (id === 'modal-member') {
      document.getElementById('nm-name').value = '';
      document.getElementById('nm-tag').value  = '';
      const name = Store.CLANS_META.find(c => c.id === Store.getUI().activeClan)?.name;
      document.getElementById('modal-member-clan').textContent = name;
    }
    if (id === 'modal-rot') {
      document.getElementById('rot-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('rot-tag').value  = '';
      document.getElementById('rot-name').value = '';
      document.getElementById('rot-don').value  = '0';
    }
    document.getElementById(id)?.classList.add('open');
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
  }

  // ── Utils ─────────────────────────────────────────────────
  function _setDate() {
    const el = document.getElementById('dash-date');
    if (el) el.textContent = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  // ── API pública ───────────────────────────────────────────
  return {
    init,
    login,
    logout,
    goPage,
    toggleSidebar,
    toggleTheme,
    connectSheets,
    syncAll,
    showSync,
    // Renders
    renderDashboard,
    renderClan,
    renderWarPage,
    renderCWLPage,
    renderDonPage,
    renderRotaciones,
    renderSorteo,
    renderConfig,
    // Actions
    saveWarReg,
    saveCWLReg,
    saveDonReg,
    saveRotation,
    runSorteo,
    addMember,
    saveWarResult,
    // Modals
    openModal,
    closeModal,
    // Borrar
    confirmDeleteMember,
    confirmDeleteWar,
    confirmResetDonations,
    // War nuevo flujo
    saveWarFull,
  };

})();

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());