(() => {
  'use strict';

  // Helpers
  const $ = (sel, root=document) => root.querySelector(sel);

  function setLoading(el, on) {
    if (!el) return;
    if (on) {
      el.setAttribute('aria-busy', 'true');
      el.classList.add('opacity-60', 'pointer-events-none');
    } else {
      el.removeAttribute('aria-busy');
      el.classList.remove('opacity-60', 'pointer-events-none');
    }
  }

  function toast(msg, type='info') {
    try {
      console[type === 'error' ? 'error' : 'log']('[toast]', msg);
      if (type === 'error') alert(msg);
    } catch {
      alert(msg);
    }
  }

  async function ensureChartJs() {
    if (typeof window.Chart !== 'undefined') return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Falha ao carregar Chart.js'));
      document.head.appendChild(s);
    });
  }

  async function callGeminiAPI(prompt, schema) {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, schema })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function getPipelineData() {
    const { data, error } = await window.supabase
      .from('pipeline')
      .select('status,valor')
      .in('status', ['Ganho', 'Proposta']);
    if (error) throw error;
    return (data || []).reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + (row.valor || 0);
      return acc;
    }, {});
  }

  const state = { chart: null };

  async function handleGenerateForecast() {
    const btn = $('#btnGenerateForecast');
    try {
      setLoading(btn, true);
      const pipelineTotals = await getPipelineData();
      const prompt = `Considere os seguintes dados de pipeline:\n` +
        Object.entries(pipelineTotals).map(([k,v]) => `${k}: ${v}`).join('\n') +
        `\nProjete KPIs de receita para Q3 e Q4.`;
      const schema = {
        type: 'object',
        properties: {
          q3: { type: 'number' },
          q4: { type: 'number' },
          analysis: { type: 'string' }
        },
        required: ['q3', 'q4', 'analysis']
      };
      const result = await callGeminiAPI(prompt, schema);
      $('#kpi-q3').textContent = (result.q3 ?? 0).toLocaleString('pt-BR');
      $('#kpi-q4').textContent = (result.q4 ?? 0).toLocaleString('pt-BR');
      $('#forecast-analysis').textContent = result.analysis || '';

      await ensureChartJs();
      const ctx = document.getElementById('forecastChart');
      if (ctx) {
        if (state.chart) state.chart.destroy();
        state.chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Q3', 'Q4'],
            datasets: [{ label: 'KPIs previstos', data: [result.q3, result.q4], tension: 0.3, fill: false }]
          },
          options: { responsive: true }
        });
      }
    } catch (e) {
      console.error('[forecast]', e);
      toast('Falha ao gerar previsão', 'error');
    } finally {
      setLoading(btn, false);
    }
  }

  document.getElementById('btnGenerateForecast')?.addEventListener('click', handleGenerateForecast);
  window.handleGenerateForecast = handleGenerateForecast;
})();

