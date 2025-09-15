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
      
      // Check if empty
      if(window.state.db.professionals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-xs text-zinc-500 py-6">Nenhum profissional ainda. <button onclick="document.getElementById(\'btn-open-modal\')?.click()" class="text-blue-500 underline ml-1">Adicionar primeiro</button></td></tr>';
        selCreate.innerHTML = '<option value="">Nenhum profissional</option>';
        if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
        return;
      }
      
      tbody.innerHTML = '';
      selCreate.innerHTML = '';
      if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
      (window.state.db.professionals || []).forEach(p => {
        const tr = document.createElement('tr');
        const hourly = (typeof window.formatHourly === 'function') ? window.formatHourly(p.hourly_rate) : (p.hourly_rate ?? '-');
        tr.innerHTML = `<td class="py-2 pr-4">${p.name}</td><td class="py-2 pr-4">${p.email ?? '-'}</td><td class="py-2">${p.role ?? '-'}</td><td class="py-2 pr-4">R$ ${hourly}</td>`;
        tbody.appendChild(tr);
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        selCreate.appendChild(opt);
        if (selFilter) selFilter.appendChild(opt.cloneNode(true));
      });
    } catch (e) {
      console.error('loadProfessionals', e);
      const tbody = document.getElementById('professionals-tbody');
      if(tbody){
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-xs text-red-400 py-4">Falha ao carregar profissionais <button onclick="window.loadProfessionals?.(true)" class="text-blue-500 underline ml-1">Tentar novamente</button></td></tr>';
      }
      window.showNotification?.('Erro ao carregar profissionais', 'error');
    }
  }

  function openProfModal() {
    document.getElementById('modal-prof')?.classList.remove('hidden');
  }

  function closeProfModal() {
    document.getElementById('modal-prof')?.classList.add('hidden');
    document.getElementById('modal-prof-error')?.classList.add('hidden');
    ['modal-prof-name', 'modal-prof-email', 'modal-prof-role', 'modal-prof-hourly'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }

    async function submitProfessional() {
    const nameEl = document.getElementById('modal-prof-name');
    const emailEl = document.getElementById('modal-prof-email');
    const roleEl = document.getElementById('modal-prof-role');
    const hourlyEl = document.getElementById('modal-prof-hourly');
    const submitBtn = document.getElementById('modal-prof-submit');
    const errorDiv = document.getElementById('modal-prof-error');

    const name = nameEl?.value?.trim();
    const email = emailEl?.value?.trim();
    const role = roleEl?.value?.trim();
    const hourlyVal = hourlyEl?.value?.trim();

    // Clear previous errors
    if (errorDiv) errorDiv.textContent = '';

    if (!name) {
      if (errorDiv) errorDiv.textContent = 'Nome é obrigatório';
      nameEl?.focus();
      return;
    }

    const hourly_rate = hourlyVal ? parseFloat(hourlyVal) : null;
    if (hourlyVal && (isNaN(hourly_rate) || hourly_rate < 0)) {
      if (errorDiv) errorDiv.textContent = 'Valor por hora deve ser um número válido';
      hourlyEl?.focus();
      return;
    }

    // Disable submit button and show loading
    const originalText = submitBtn?.textContent || 'Salvar';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Salvando...';
      submitBtn.style.opacity = '0.6';
    }

    try {
      const response = await fetch('/api/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, hourly_rate })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar profissional');
      }

      window.showNotification?.('Profissional criado com sucesso', 'success');
      closeProfModal();
      await window.loadProfessionals?.(true);
      if(typeof window.populateAllocationSelects === 'function') {
        window.populateAllocationSelects();
      }
    } catch (error) {
      console.error('submitProfessional', error);
      if (errorDiv) errorDiv.textContent = error.message;
      window.showNotification?.('Erro ao criar profissional: ' + error.message, 'error');
    } finally {
      // Restore submit button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.style.opacity = '1';
      }
    }
  }

  // attach UI hooks
  document.getElementById('btn-add-prof')?.addEventListener('click', () => openProfModal());
  document.getElementById('modal-prof-cancel')?.addEventListener('click', () => closeProfModal());
  document.getElementById('modal-prof-submit')?.addEventListener('click', () => submitProfessional());

  // exports
  window.loadProfessionals = loadProfessionals;
  window.openProfModal = openProfModal;
  window.closeProfModal = closeProfModal;
  window.submitProfessional = submitProfessional;
  window.closeProfModal = closeProfModal;

})();
