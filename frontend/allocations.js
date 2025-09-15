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

  // Expor
  window.loadAllocations = loadAllocations;
  window.populateAllocationSelects = populateAllocationSelects;
  window.createAllocation = createAllocation;
})();
