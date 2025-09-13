(() => {
  'use strict';

  const DEFAULT_CAPACITY = 160; // horas por período (ex.: mês)
  let capacityData = [];

  async function loadCapacityData() {
    const [profRes, allocRes] = await Promise.all([
      fetch('/api/professionals'),
      fetch('/api/allocations')
    ]);
    const professionals = await profRes.json().catch(() => []);
    const allocations = await allocRes.json().catch(() => []);

    const hoursByProf = {};
    (allocations || []).forEach(a => {
      const pid = a.professional_id;
      hoursByProf[pid] = (hoursByProf[pid] || 0) + Number(a.hours || 0);
    });

    return (professionals || []).map(p => ({
      id: p.id,
      name: p.name || `ID ${p.id}`,
      allocated: hoursByProf[p.id] || 0,
      capacity: DEFAULT_CAPACITY
    }));
  }

  async function renderCapacityGapChart() {
    const ctx = document.getElementById('capacityGapChart');
    if (!ctx) return;

    capacityData = await loadCapacityData();
    const labels = capacityData.map(d => d.name);
    const allocated = capacityData.map(d => d.allocated);
    const available = capacityData.map(d => Math.max(0, d.capacity - d.allocated));

    if (window.capacityGapChart) {
      window.capacityGapChart.destroy();
    }

    window.capacityGapChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Alocado',
            data: allocated,
            backgroundColor: 'rgba(59,130,246,0.8)', // azul
            stack: 'stack1'
          },
          {
            label: 'Disponível',
            data: available,
            backgroundColor: 'rgba(16,185,129,0.8)', // verde
            stack: 'stack1'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true }
        }
      }
    });
  }

  async function callGeminiAPI(prompt) {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha na Gemini API');
    return data.text || data.response || '';
  }

  async function analyzeRisks() {
    if (!capacityData.length) await renderCapacityGapChart();
    const summary = capacityData
      .map(d => `${d.name}: ${d.allocated}/${d.capacity}h`)
      .join('\n');
    try {
      const txt = await callGeminiAPI(
        `Analise riscos de capacidade com base nos dados a seguir:\n${summary}`
      );
      const outEl = document.getElementById('riskAnalysisText');
      if (outEl) outEl.textContent = txt;
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  }

  document.getElementById('btnAnalyzeRisks')?.addEventListener('click', analyzeRisks);

  renderCapacityGapChart();
  window.renderCapacityGapChart = renderCapacityGapChart;
})();
