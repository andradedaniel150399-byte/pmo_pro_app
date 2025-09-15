// professionals.js - carregamento, render e modal de profissionais
(function () {
  const fetchJson = window.fetchJSON || (async (url) => {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  });

  function formatHourly(v) {
    if (v === undefined || v === null) return '-';
    const n = Number(v);
    if (!Number.isFinite(n)) return '-';
    return n.toFixed(2);
  }
  // export
  window.formatHourly = window.formatHourly || formatHourly;

  async function loadProfessionals(force = false) {
    try {
      const tbody = document.getElementById('professionals-tbody');
      if(tbody){
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-xs text-zinc-400">Carregando...</td></tr>'
      }
      if (force || !window.state.db.professionals.length) {
        window.state.db.professionals = await fetchJson('/api/professionals');
      }
      const selCreate = document.getElementById('alloc-prof');
      const selFilter = document.getElementById('filter-prof');
      if (!tbody || !selCreate) return;
      tbody.innerHTML = '';
      selCreate.innerHTML = '';
      if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
      (window.state.db.professionals || []).forEach(p => {
        const tr = document.createElement('tr');
        const hourly = (typeof window.formatHourly === 'function') ? window.formatHourly(p.hourly_rate) : (p.hourly_rate ?? '-');
        tr.innerHTML = `<td class="py-2 pr-4">${p.name}</td><td class="py-2 pr-4">${p.email ?? '-'}</td><td class="py-2">${p.role ?? '-'}</td><td class="py-2 pr-4">${hourly}</td>`;
        tbody.appendChild(tr);
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        selCreate.appendChild(opt);
        if (selFilter) selFilter.appendChild(opt.cloneNode(true));
      });
    } catch (e) {
      console.error('loadProfessionals', e);
      window.showNotification?.('Erro ao carregar profissionais', 'error');
    }
  }

  function openProfModal() {
    document.getElementById('modal-prof')?.classList.remove('hidden');
  }

  function closeProfModal() {
    document.getElementById('modal-prof')?.classList.add('hidden');
    document.getElementById('modal-prof-error')?.classList.add('hidden');
    ['modal-prof-name', 'modal-prof-email', 'modal-prof-role', 'modal-prof-hourly-rate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }

  async function submitProfModal() {
    const name = document.getElementById('modal-prof-name')?.value?.trim();
    const email = document.getElementById('modal-prof-email')?.value?.trim() || null;
    const role = document.getElementById('modal-prof-role')?.value?.trim() || null;
    const hrRaw = document.getElementById('modal-prof-hourly-rate')?.value?.trim();
    const errorEl = document.getElementById('modal-prof-error');
    if (!name) { if (errorEl) { errorEl.textContent = 'Nome é obrigatório'; errorEl.classList.remove('hidden'); } return; }
    let hourly_rate = undefined;
    if (hrRaw) { const n = Number(String(hrRaw).replace(',', '.')); if (!Number.isFinite(n) || n < 0) { if (errorEl) { errorEl.textContent = 'Taxa inválida'; errorEl.classList.remove('hidden'); } return; } hourly_rate = n; }
    try {
      const res = await fetch('/api/professionals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, role, hourly_rate }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || j.message || 'erro');
      closeProfModal();
      window.state.db.professionals = [];
      await loadProfessionals(true);
      window.showNotification?.('Profissional adicionado', 'success');
    } catch (e) { if (errorEl) { errorEl.textContent = e.message || 'Erro ao criar profissional'; errorEl.classList.remove('hidden'); } }
  }

  // attach UI hooks
  document.getElementById('btn-add-prof')?.addEventListener('click', () => openProfModal());
  document.getElementById('modal-prof-cancel')?.addEventListener('click', () => closeProfModal());
  document.getElementById('modal-prof-submit')?.addEventListener('click', () => submitProfModal());

  // exports
  window.loadProfessionals = loadProfessionals;
  window.openProfModal = openProfModal;
  window.closeProfModal = closeProfModal;

})();
