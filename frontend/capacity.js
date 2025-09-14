// capacity.js - carga e render gráfico de capacidade vs alocação
(function () {
  const DEFAULT_CAPACITY = 160;

  async function loadCapacityData() {
    const [professionals, allocations] = await Promise.all([ window.fetchJSON('/api/professionals'), window.fetchJSON('/api/allocations') ]);
    const hoursByProf = {};
    (allocations || []).forEach(a => { const pid = a.professional_id; hoursByProf[pid] = (hoursByProf[pid] || 0) + Number(a.hours || 0); });
    const data = (professionals || []).map(p => ({ id: p.id, name: p.name || `ID ${p.id}`, allocated: hoursByProf[p.id] || 0, capacity: DEFAULT_CAPACITY }));
    window.state.capacityData = data;
    return data;
  }

  async function renderCapacityGapChart() {
    const ctx = document.getElementById('capacityGapChart'); if (!ctx) return; await loadCapacityData();
    const labels = window.state.capacityData.map(d => d.name);
    const allocated = window.state.capacityData.map(d => d.allocated);
    const available = window.state.capacityData.map(d => Math.max(0, d.capacity - d.allocated));
    if (window.state.charts.capacityGap) window.state.charts.capacityGap.destroy();
    window.state.charts.capacityGap = new Chart(ctx, { type: 'bar', data: { labels, datasets: [ { label: 'Alocado', data: allocated, backgroundColor: 'rgba(59,130,246,0.8)', stack: 'stack1' }, { label: 'Disponível', data: available, backgroundColor: 'rgba(16,185,129,0.8)', stack: 'stack1' } ] }, options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } });
  }

  async function analyzeRisks() {
    if (!window.state.capacityData.length) await renderCapacityGapChart();
    const summary = window.state.capacityData.map(d => `${d.name}: ${d.allocated}/${d.capacity}h`).join('\n');
    try {
      const txt = await window.callGeminiAPI({ prompt: `Analise riscos de capacidade com base nos dados a seguir:\n${summary}` });
      const outEl = document.getElementById('riskAnalysisText'); if (outEl) outEl.textContent = txt.text || txt.response || '';
    } catch (e) { window.showNotification?.('Erro ao analisar riscos', 'error'); }
  }

  window.loadCapacityData = loadCapacityData;
  window.renderCapacityGapChart = renderCapacityGapChart;
  window.analyzeRisks = analyzeRisks;
})();
// capacity.js — cálculos e gráficos de capacidade
(function () {
  const DEFAULT_CAPACITY = 160;

  async function loadCapacityData() {
    const [profRes, allocRes] = await Promise.all([ fetch('/api/professionals'), fetch('/api/allocations') ]);
    const professionals = await profRes.json().catch(() => []);
    const allocations = await allocRes.json().catch(() => []);
    const hoursByProf = {};
    (allocations || []).forEach(a => { const pid = a.professional_id; hoursByProf[pid] = (hoursByProf[pid] || 0) + Number(a.hours || 0); });
    return (professionals || []).map(p => ({ id: p.id, name: p.name || `ID ${p.id}`, allocated: hoursByProf[p.id] || 0, capacity: DEFAULT_CAPACITY }));
  }

  async function renderCapacityGapChart() {
    const ctx = document.getElementById('capacityGapChart'); if (!ctx) return; window.state.capacityData = await loadCapacityData();
    const labels = window.state.capacityData.map(d => d.name); const allocated = window.state.capacityData.map(d => d.allocated); const available = window.state.capacityData.map(d => Math.max(0, d.capacity - d.allocated));
    if (window.state.charts.capacityGap) window.state.charts.capacityGap.destroy();
    window.state.charts.capacityGap = new Chart(ctx, { type: 'bar', data: { labels, datasets: [ { label: 'Alocado', data: allocated, backgroundColor: 'rgba(59,130,246,0.8)', stack: 'stack1' }, { label: 'Disponível', data: available, backgroundColor: 'rgba(16,185,129,0.8)', stack: 'stack1' } ] }, options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } });
  }

  async function analyzeRisks() {
    if (!window.state.capacityData.length) await renderCapacityGapChart();
    const summary = window.state.capacityData.map(d => `${d.name}: ${d.allocated}/${d.capacity}h`).join('\n');
    try { const txt = await window.callGeminiAPI({ prompt: `Analise riscos de capacidade com base nos dados a seguir:\n${summary}` }); const outEl = document.getElementById('riskAnalysisText'); if (outEl) outEl.textContent = txt.text || txt.response || ''; } catch (e) { alert('Erro: ' + e.message); }
  }

  window.loadCapacityData = loadCapacityData;
  window.renderCapacityGapChart = renderCapacityGapChart;
  window.analyzeRisks = analyzeRisks;
})();
