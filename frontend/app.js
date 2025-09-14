// app.js — entrypoint leve para inicialização da UI e ligação entre módulos

window.state = window.state || { theme: localStorage.getItem('theme') || 'light', user: null, db: { projects: [], professionals: [], allocations: [], comments: [], overview: null, timeseries: null }, charts: {}, dashboardLayout: [], capacityData: [] };

function switchView(viewId) {
  document.querySelectorAll('.tab-panel').forEach(sec => {
    const active = sec.id === viewId;
    sec.classList.toggle('hidden', !active);
    sec.classList.toggle('block', active);
  });
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === viewId));
}

function applyTheme() {
  window.state.theme = localStorage.getItem('theme') || 'light';
  const isDark = window.state.theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { const view = btn.dataset.tab; switchView(view); location.hash = view; }));
  window.addEventListener('hashchange', () => { const view = location.hash.slice(1); if (view) switchView(view); });
  const initial = location.hash.slice(1) || 'tab-dashboard'; switchView(initial);
  applyTheme();

  // ligar botões principais a funções expostas pelos módulos
  document.getElementById('btnCreateAlloc')?.addEventListener('click', () => typeof window.createAllocation === 'function' && window.createAllocation());
  document.getElementById('btnFilterAlloc')?.addEventListener('click', () => typeof window.applyAllocationFilters === 'function' && window.applyAllocationFilters());
  document.getElementById('btnAnalyzeRisks')?.addEventListener('click', () => typeof window.analyzeRisks === 'function' && window.analyzeRisks());
  document.getElementById('btnCreateProject')?.addEventListener('click', () => window.showNotification?.('Funcionalidade Criar Projeto não implementada', 'info'));
  document.getElementById('btnSync')?.addEventListener('click', () => typeof window.handlePipefySync === 'function' ? window.handlePipefySync() : window.showNotification?.('Configurar Pipefy em Settings', 'info'));

  // chamada de inicialização de módulos (não-bloqueante)
  (async () => {
    try {
      if (typeof window.loadProjects === 'function') await window.loadProjects();
      if (typeof window.loadProfessionals === 'function') await window.loadProfessionals();
      if (typeof window.loadAllocations === 'function') await window.loadAllocations();
      if (typeof window.renderProfitability === 'function') window.renderProfitability();
      if (typeof window.renderKanban === 'function') window.renderKanban();
      if (typeof window.renderCapacityGapChart === 'function') window.renderCapacityGapChart();
    } catch (e) { console.error('initialization', e); }
  })();
});

