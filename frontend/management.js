// Script da página de gestão: abas internas, alocação em lote e limpeza

document.addEventListener('DOMContentLoaded', () => {
  bindInternalTabs();
  loadProfessionals();
  loadProjects();
  const hoursEl = document.getElementById('batch-hours');
  const projectsEl = document.getElementById('batch-projects');
  hoursEl?.addEventListener('input', updateBatchWarning);
  projectsEl?.addEventListener('change', updateBatchWarning);
  document.getElementById('batch-submit')?.addEventListener('click', submitBatchAllocation);
  document.getElementById('clean-submit')?.addEventListener('click', runCleanup);
});

function bindInternalTabs() {
  const btns = document.querySelectorAll('.mgmt-tab-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-tab');
      document.querySelectorAll('.mgmt-tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(target)?.classList.remove('hidden');
    });
  });
}

async function loadProfessionals() {
  try {
    const r = await fetch('/api/professionals');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    const batchSel = document.getElementById('batch-professional');
    const cleanSel = document.getElementById('clean-professional');
    if (batchSel) batchSel.innerHTML = '<option value="">Profissional</option>';
    if (cleanSel) cleanSel.innerHTML = '<option value="">Todos</option>';
    (j || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      batchSel?.appendChild(opt);
      cleanSel?.appendChild(opt.cloneNode(true));
    });
  } catch (e) { console.error('loadProfessionals', e); }
}

async function loadProjects() {
  try {
    const r = await fetch('/api/metrics/top-projects?limit=999');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    const batchSel = document.getElementById('batch-projects');
    const cleanSel = document.getElementById('clean-project');
    if (batchSel) batchSel.innerHTML = '';
    if (cleanSel) cleanSel.innerHTML = '<option value="">Todos</option>';
    (j.items || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      batchSel?.appendChild(opt.cloneNode(true));
      cleanSel?.appendChild(opt.cloneNode(true));
    });
  } catch (e) { console.error('loadProjects', e); }
}

function updateBatchWarning() {
  const hours = Number(document.getElementById('batch-hours')?.value || 0);
  const projects = Array.from(document.getElementById('batch-projects')?.selectedOptions || []);
  const warnEl = document.getElementById('batch-warning');
  const totalPerDay = hours * projects.length;
  if (totalPerDay > 8) {
    warnEl?.classList.remove('hidden');
    if (warnEl) warnEl.textContent = `⚠️ Superalocação: ${totalPerDay}h/dia`;
  } else {
    warnEl?.classList.add('hidden');
    if (warnEl) warnEl.textContent = '';
  }
  return totalPerDay;
}

async function submitBatchAllocation() {
  const professional_id = document.getElementById('batch-professional')?.value;
  const start = document.getElementById('batch-start')?.value;
  const end = document.getElementById('batch-end')?.value;
  const hoursPerDay = Number(document.getElementById('batch-hours')?.value || 0);
  const projects = Array.from(document.getElementById('batch-projects')?.selectedOptions || []).map(o => o.value);
  const totalPerDay = updateBatchWarning();
  if (!professional_id || !start || !end || !hoursPerDay || projects.length === 0) {
    return alert('Preencha todos os campos.');
  }
  if (totalPerDay > 8) return alert('Horas por dia excedem 8h.');
  if (!confirm(`Confirmar alocação de ${hoursPerDay}h/dia em ${projects.length} projeto(s)?`)) return;
  const days = Math.floor((new Date(end) - new Date(start)) / 86400000) + 1;
  for (const project_id of projects) {
    try {
      const r = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id, professional_id, hours: hoursPerDay * days, start_date: start, end_date: end })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'erro');
    } catch (e) {
      console.error('submitBatchAllocation', e);
      alert('Erro: ' + e.message);
      return;
    }
  }
  alert('Alocações criadas!');
  if (typeof window.loadAllocations === 'function') window.loadAllocations();
}

async function runCleanup() {
  const month = document.getElementById('clean-month')?.value; // formato YYYY-MM
  const professional_id = document.getElementById('clean-professional')?.value;
  const project_id = document.getElementById('clean-project')?.value;
  if (!confirm('Confirma limpeza das alocações filtradas?')) return;
  try {
    const r = await fetch('/api/allocations/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, professional_id, project_id })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    alert(`Removidas ${j.deleted ?? 0} alocações`);
    if (typeof window.loadAllocations === 'function') window.loadAllocations();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

