// allocations.js — gerencia criação e listagem de alocações (consolidado)
(function(){
  function setAllocationsLoading(){
    const tbody = document.getElementById('allocations-tbody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-xs text-zinc-400 py-4">Carregando alocações...</td></tr>';
  }

  function setAllocationsEmpty(){
    const tbody = document.getElementById('allocations-tbody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-xs text-zinc-500 py-6">Nenhuma alocação ainda. <button onclick="window.createAllocation?.()" class="text-blue-500 underline ml-1">Criar primeira</button></td></tr>';
  }

  function setAllocationsError(msg = 'Falha ao carregar alocações'){
    const tbody = document.getElementById('allocations-tbody');
    if(tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center text-xs text-red-400 py-4">${msg} <button onclick="window.loadAllocations?.(true)" class="text-blue-500 underline ml-1">Tentar novamente</button></td></tr>`;
  }

  async function loadAllocations(force=false){
    const tbody = document.getElementById('allocations-tbody');
    setAllocationsLoading();
    try {
      if(force || !window.state.db.allocations.length){
        const arr = await window.fetchJSON('/api/allocations');
        window.state.db.allocations = arr || [];
      }
      if(!tbody) return;
      
      // Check if empty after load
      if(window.state.db.allocations.length === 0) {
        setAllocationsEmpty();
        return;
      }
      
      tbody.innerHTML='';
      (window.state.db.allocations||[]).forEach(a=>{
        const tr=document.createElement('tr');
        const proj = (window.state.db.projects||[]).find(p=>String(p.id)===String(a.project_id));
        const prof = (window.state.db.professionals||[]).find(p=>String(p.id)===String(a.professional_id));
        tr.innerHTML = `<td class=\"py-2 pr-4\">${proj?.name || a.project_name || a.project_id}</td><td class=\"py-2 pr-4\">${prof?.name || a.professional_name || a.professional_id}</td><td class=\"py-2 pr-4\">${a.hours || 0}</td><td class=\"py-2\">${(a.start||'')}${a.end?' - '+a.end:''}</td>`;
        tbody.appendChild(tr);
      });
    }catch(e){
      console.error('loadAllocations', e);
      setAllocationsError();
    }
  }

  function populateAllocationSelects(){
    const selProj = document.getElementById('alloc-project');
    const selProf = document.getElementById('alloc-prof');
    if(selProj){
      selProj.innerHTML = '<option value="">Projeto</option>';
      (window.state.db.projects||[]).forEach(p=>{
        const opt=document.createElement('option');
        opt.value=p.id; opt.textContent=p.name; selProj.appendChild(opt);
      });
    }
    if(selProf){
      selProf.innerHTML = '<option value="">Profissional</option>';
      (window.state.db.professionals||[]).forEach(p=>{
        const opt=document.createElement('option');
        opt.value=p.id; opt.textContent=p.name; selProf.appendChild(opt);
      });
    }
  }

  async function createAllocation(){
    const project = document.getElementById('alloc-project')?.value;
    const prof = document.getElementById('alloc-prof')?.value;
    const hoursVal = document.getElementById('alloc-hours')?.value;
    const start = document.getElementById('alloc-start')?.value;
    const end = document.getElementById('alloc-end')?.value;
    const hours = Number(hoursVal);
    const btn = document.getElementById('btnCreateAlloc');
    if(!project || !prof || !hours){
      return window.showNotification?.('Preencha projeto, profissional e horas válidas','error');
    }
    // Disable button and show loading state
    const originalText = btn?.textContent || 'Criar';
    if(btn) {
      btn.disabled = true;
      btn.textContent = 'Criando...';
      btn.style.opacity = '0.6';
    }
    try{
      const r = await fetch('/api/allocations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:project,professional_id:prof,hours,start,end})});
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||'Erro ao criar');
      window.showNotification?.('Alocação criada com sucesso','success');
      // força recarregar para refletir nova alocação
      await loadAllocations(true);
      // reset campos do formulário
      document.getElementById('alloc-hours').value='';
      document.getElementById('alloc-start').value='';
      document.getElementById('alloc-end').value='';
    }catch(e){
      console.error('createAllocation', e);
      window.showNotification?.('Erro ao criar alocação: '+e.message,'error');
    }finally{
      // Restore button state
      if(btn) {
        btn.disabled = false;
        btn.textContent = originalText;
        btn.style.opacity = '1';
      }
    }
  }

  // Atualizar renderização das alocações

  function renderAllocations(allocations) {
    const tbody = document.querySelector('#allocationsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = allocations.map(alloc => `
      <tr data-id="${alloc.id}">
        <td>${formatDate(alloc.date)}</td>
        <td>${alloc.project_name || `Projeto ${alloc.project_id}`}</td>
        <td>${alloc.professional_name || `Prof ${alloc.professional_id}`}</td>
        <td>${alloc.professional_role || 'N/A'}</td>
        <td>${Number(alloc.hours).toFixed(1)}h</td>
        <td>${alloc.type || 'N/A'}</td>
        <td>R$ ${calculateAllocationValue(alloc)}</td>
        <td>
          <button onclick="editAllocation(${alloc.id})" class="btn-edit">✏️</button>
          <button onclick="deleteAllocation(${alloc.id})" class="btn-delete">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  // Calcular valor da alocação
  function calculateAllocationValue(allocation) {
    const hours = Number(allocation.hours) || 0;
    const hourlyRate = Number(allocation.hourly_rate) || 0;
    return (hours * hourlyRate).toFixed(2);
  }

  // Atualizar formulário de alocação
  function showAllocationForm(allocation = null) {
    const isEdit = !!allocation;
    const formHtml = `
      <div class="modal-overlay" onclick="closeAllocationForm()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <h3>${isEdit ? 'Editar' : 'Nova'} Alocação</h3>
          <form id="allocationForm" onsubmit="saveAllocation(event)">
            <input type="hidden" id="allocId" value="${allocation?.id || ''}">
            
            <div class="form-group">
              <label for="allocProject">Projeto *</label>
              <select id="allocProject" required>
                <option value="">Selecione um projeto...</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="allocProfessional">Profissional *</label>
              <select id="allocProfessional" required>
                <option value="">Selecione um profissional...</option>
              </select>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="allocDate">Data *</label>
                <input type="date" id="allocDate" required 
                       value="${allocation?.date || new Date().toISOString().slice(0,10)}">
              </div>
              
              <div class="form-group">
                <label for="allocHours">Horas *</label>
                <input type="number" id="allocHours" step="0.5" min="0.5" max="24" required
                       value="${allocation?.hours || ''}">
              </div>
            </div>
            
            <div class="form-group">
              <label for="allocType">Tipo de Trabalho</label>
              <select id="allocType">
                <option value="">Selecione...</option>
                <option value="development" ${allocation?.type === 'development' ? 'selected' : ''}>Desenvolvimento</option>
                <option value="planning" ${allocation?.type === 'planning' ? 'selected' : ''}>Planejamento</option>
                <option value="meeting" ${allocation?.type === 'meeting' ? 'selected' : ''}>Reunião</option>
                <option value="review" ${allocation?.type === 'review' ? 'selected' : ''}>Revisão</option>
                <option value="testing" ${allocation?.type === 'testing' ? 'selected' : ''}>Testes</option>
                <option value="documentation" ${allocation?.type === 'documentation' ? 'selected' : ''}>Documentação</option>
                <option value="consulting" ${allocation?.type === 'consulting' ? 'selected' : ''}>Consultoria</option>
              </select>
            </div>
            
            <div class="form-actions">
              <button type="button" onclick="closeAllocationForm()">Cancelar</button>
              <button type="submit">${isEdit ? 'Atualizar' : 'Criar'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', formHtml);
    
    // Carregar projetos e profissionais para os selects
    loadProjectsForSelect();
    loadProfessionalsForSelect();
    
    // Se é edição, selecionar valores
    if (isEdit) {
      setTimeout(() => {
        document.getElementById('allocProject').value = allocation.project_id;
        document.getElementById('allocProfessional').value = allocation.professional_id;
      }, 100);
    }
  }

  // Carregar projetos para select
  async function loadProjectsForSelect() {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      const projects = result.data || result;
      
      const select = document.getElementById('allocProject');
      select.innerHTML = '<option value="">Selecione um projeto...</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
    }
  }

  // Carregar profissionais para select  
  async function loadProfessionalsForSelect() {
    try {
      const response = await fetch('/api/professionals');
      const professionals = await response.json();
      
      const select = document.getElementById('allocProfessional');
      select.innerHTML = '<option value="">Selecione um profissional...</option>' +
        professionals.map(p => `<option value="${p.id}">${p.name} (${p.role || 'N/A'})</option>`).join('');
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
    }
  }

  // Salvar alocação
  async function saveAllocation(event) {
    event.preventDefault();
    
    const id = document.getElementById('allocId').value;
    const project_id = document.getElementById('allocProject').value;
    const professional_id = document.getElementById('allocProfessional').value;
    const date = document.getElementById('allocDate').value;
    const hours = document.getElementById('allocHours').value;
    const type = document.getElementById('allocType').value;
    
    const data = {
      project_id: Number(project_id),
      professional_id: Number(professional_id),
      date,
      hours: Number(hours)
    };
    
    if (type) data.type = type;
    
    try {
      const url = id ? `/api/allocations/${id}` : '/api/allocations';
      const method = id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error('Erro ao salvar');
      
      closeAllocationForm();
      loadAllocations(); // Recarregar lista
      showNotification(`Alocação ${id ? 'atualizada' : 'criada'} com sucesso!`);
    } catch (error) {
      console.error('Erro:', error);
      showNotification('Erro ao salvar alocação', 'error');
    }
  }

  function closeAllocationForm() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  // Expor
  window.loadAllocations = loadAllocations;
  window.populateAllocationSelects = populateAllocationSelects;
  window.createAllocation = createAllocation;
})();
