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

  // Atualizar a função renderProfessionals para incluir novos campos

function renderProfessionals(professionals) {
  const tbody = document.querySelector('#professionalsTable tbody');
  if (!tbody) return;

  tbody.innerHTML = professionals.map(prof => `
    <tr data-id="${prof.id}">
      <td>${prof.name || 'N/A'}</td>
      <td>${prof.role || 'N/A'}</td>
      <td>R$ ${prof.hourly_rate ? Number(prof.hourly_rate).toFixed(2) : '0.00'}</td>
      <td>R$ ${prof.cost ? Number(prof.cost).toFixed(2) : '0.00'}</td>
      <td>${prof.utilization ? (Number(prof.utilization) * 100).toFixed(1) + '%' : 'N/A'}</td>
      <td>
        <button onclick="editProfessional(${prof.id})" class="btn-edit">✏️</button>
        <button onclick="deleteProfessional(${prof.id})" class="btn-delete">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// Atualizar formulário de criação/edição
function showProfessionalForm(professional = null) {
  const isEdit = !!professional;
  const formHtml = `
    <div class="modal-overlay" onclick="closeProfessionalForm()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <h3>${isEdit ? 'Editar' : 'Novo'} Profissional</h3>
        <form id="professionalForm" onsubmit="saveProfessional(event)">
          <input type="hidden" id="profId" value="${professional?.id || ''}">
          
          <div class="form-group">
            <label for="profName">Nome *</label>
            <input type="text" id="profName" required value="${professional?.name || ''}">
          </div>
          
          <div class="form-group">
            <label for="profRole">Função</label>
            <select id="profRole">
              <option value="">Selecione...</option>
              <option value="PM" ${professional?.role === 'PM' ? 'selected' : ''}>Project Manager</option>
              <option value="Dev" ${professional?.role === 'Dev' ? 'selected' : ''}>Developer</option>
              <option value="Designer" ${professional?.role === 'Designer' ? 'selected' : ''}>Designer</option>
              <option value="QA" ${professional?.role === 'QA' ? 'selected' : ''}>QA</option>
              <option value="DevOps" ${professional?.role === 'DevOps' ? 'selected' : ''}>DevOps</option>
              <option value="Consultant" ${professional?.role === 'Consultant' ? 'selected' : ''}>Consultant</option>
            </select>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="profHourlyRate">Taxa/Hora (R$)</label>
              <input type="number" id="profHourlyRate" step="0.01" min="0" 
                     value="${professional?.hourly_rate || ''}">
            </div>
            
            <div class="form-group">
              <label for="profCost">Custo Mensal (R$)</label>
              <input type="number" id="profCost" step="0.01" min="0" 
                     value="${professional?.cost || ''}">
            </div>
          </div>
          
          <div class="form-group">
            <label for="profUtilization">Utilização (%)</label>
            <input type="number" id="profUtilization" step="0.01" min="0" max="100" 
                   value="${professional?.utilization ? (Number(professional.utilization) * 100) : ''}">
            <small>Percentual de utilização do profissional (0-100%)</small>
          </div>
          
          <div class="form-actions">
            <button type="button" onclick="closeProfessionalForm()">Cancelar</button>
            <button type="submit">${isEdit ? 'Atualizar' : 'Criar'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', formHtml);
}

// Atualizar função de salvar
async function saveProfessional(event) {
  event.preventDefault();
  
  const id = document.getElementById('profId').value;
  const name = document.getElementById('profName').value;
  const role = document.getElementById('profRole').value;
  const hourly_rate = document.getElementById('profHourlyRate').value;
  const cost = document.getElementById('profCost').value;
  const utilizationPercent = document.getElementById('profUtilization').value;
  
  const data = { name };
  if (role) data.role = role;
  if (hourly_rate) data.hourly_rate = Number(hourly_rate);
  if (cost) data.cost = Number(cost);
  if (utilizationPercent) data.utilization = Number(utilizationPercent) / 100;
  
  try {
    const url = id ? `/api/professionals/${id}` : '/api/professionals';
    const method = id ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error('Erro ao salvar');
    
    closeProfessionalForm();
    loadProfessionals(); // Recarregar lista
    showNotification(`Profissional ${id ? 'atualizado' : 'criado'} com sucesso!`);
  } catch (error) {
    console.error('Erro:', error);
    showNotification('Erro ao salvar profissional', 'error');
  }
}

function closeProfessionalForm() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) modal.remove();
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
