// profitability.js - cálculo simples de lucro por projeto e renderização
(function () {
  const fmtCurrency = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function buildProfitability() {
    const rateByProf = {};
    (window.state.db.professionals || []).forEach(p => { const rate = Number(p.hourly_rate ?? p.hour_cost ?? p.cost ?? p.rate ?? 0); rateByProf[p.id] = rate; });
    const costByProject = {};
    (window.state.db.allocations || []).forEach(a => { const rate = rateByProf[a.professional_id] || 0; const hours = Number(a.hours || 0); costByProject[a.project_id] = (costByProject[a.project_id] || 0) + hours * rate; });
    return (window.state.db.projects || []).map(p => {
      const revenue = Number(p.revenue ?? p.income ?? p.budget ?? 0);
      const cost = costByProject[p.id] || 0;
      const profit = revenue - cost;
      const margin = revenue ? profit / revenue : 0;
      return { ...p, revenue, cost, profit, margin };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  function renderProfitability() {
    const list = buildProfitability();
    const ctx = document.getElementById('profitabilityChart');
    if (ctx) {
      window.state.charts.profitability?.destroy?.();
      window.state.charts.profitability = new Chart(ctx, { type: 'bar', data: { labels: list.map(p => p.name || `#${p.id}`), datasets: [{ label: 'Lucro', data: list.map(p => p.profit), backgroundColor: list.map(p => p.profit >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)') }] }, options: { scales: { y: { beginAtZero: true } } } });
    }
    const tbody = document.getElementById('profitabilityTable');
    if (tbody) {
      tbody.innerHTML = '';
      list.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2 pr-4">${p.name || p.id}</td>
          <td class="py-2 pr-4 text-right">${fmtCurrency(p.revenue)}</td>
          <td class="py-2 pr-4 text-right">${fmtCurrency(p.cost)}</td>
          <td class="py-2 pr-4 text-right">${fmtCurrency(p.profit)}</td>
          <td class="py-2 text-right font-semibold ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}">${(p.margin * 100).toFixed(1)}%</td>`;
        tbody.appendChild(tr);
      });
    }
  }

  window.buildProfitability = buildProfitability;
  window.renderProfitability = renderProfitability;
})();
// profitability.js — cálculo e renderização de profitability
(function () {
  const fmtCurrency = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function buildProfitability() {
    const rateByProf = {};
    (window.state.db.professionals || []).forEach(p => {
      const rate = Number(p.hourly_rate ?? p.hour_cost ?? p.cost ?? p.rate ?? 0);
      rateByProf[p.id] = rate;
    });
    const costByProject = {};
    (window.state.db.allocations || []).forEach(a => {
      const rate = rateByProf[a.professional_id] || 0;
      const hours = Number(a.hours || 0);
      costByProject[a.project_id] = (costByProject[a.project_id] || 0) + hours * rate;
    });
    return (window.state.db.projects || []).map(p => {
      const revenue = Number(p.revenue ?? p.income ?? p.budget ?? 0);
      const cost = costByProject[p.id] || 0;
      const profit = revenue - cost;
      const margin = revenue ? profit / revenue : 0;
      return { ...p, revenue, cost, profit, margin };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  async function renderProfitability() {
    const list = buildProfitability();
    const ctx = document.getElementById('profitabilityChart');
    if (ctx) {
      window.state.charts.profitability?.destroy?.();
      window.state.charts.profitability = new Chart(ctx, {
        type: 'bar',
        data: { labels: list.map(p => p.name || `#${p.id}`), datasets: [{ label: 'Lucro', data: list.map(p => p.profit), backgroundColor: list.map(p => p.profit >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)') }] },
        options: { scales: { y: { beginAtZero: true } } }
      });
    }
    const tbody = document.getElementById('profitabilityTable');
    if (tbody) {
      tbody.innerHTML = '';
      list.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2 pr-4">${p.name || p.id}</td>
          <td class="py-2 pr-4 text-right">${fmtCurrency(p.revenue)}</td>
          <td class="py-2 pr-4 text-right">${fmtCurrency(p.cost)}</td>
          <td class="py-2 pr-4 text-right">${fmtCurrency(p.profit)}</td>
          <td class="py-2 text-right font-semibold ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}">${(p.margin * 100).toFixed(1)}%</td>`;
        tbody.appendChild(tr);
      });
    }
  }

  window.renderProfitability = renderProfitability;
  window.buildProfitability = buildProfitability;
})();
(() => {
  'use strict';

  // Estado global compartilhado com outros módulos
  const state = (window.state = window.state || { db: {}, charts: {} });
  state.db.projects = state.db.projects || [];
  state.db.professionals = state.db.professionals || [];
  state.db.allocations = state.db.allocations || [];

  const fmtCurrency = (v) => Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  // Carrega Chart.js sob demanda
  async function ensureChartJs() {
    if (window.Chart) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Falha ao carregar Chart.js'));
      document.head.appendChild(s);
    });
  }

  // Consolida alocações e profissionais para obter custo por projeto
  function buildProfitability() {
    const rateByProf = {};
    (state.db.professionals || []).forEach(p => {
      const rate = Number(p.hourly_rate ?? p.hour_cost ?? p.cost ?? p.rate ?? 0);
      rateByProf[p.id] = rate;
    });

    const costByProject = {};
    (state.db.allocations || []).forEach(a => {
      const rate = rateByProf[a.professional_id] || 0;
      const hours = Number(a.hours || 0);
      costByProject[a.project_id] = (costByProject[a.project_id] || 0) + hours * rate;
    });

    return (state.db.projects || []).map(p => {
      const revenue = Number(p.revenue ?? p.income ?? p.budget ?? 0);
      const cost = costByProject[p.id] || 0;
      const profit = revenue - cost;
      const margin = revenue ? profit / revenue : 0;
      return { ...p, revenue, cost, profit, margin };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  async function render() {
    const list = buildProfitability();
    await ensureChartJs();

    const ctx = document.getElementById('profitabilityChart');
    if (ctx) {
      state.charts.profitability?.destroy?.();
      state.charts.profitability = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: list.map(p => p.name || `#${p.id}`),
          datasets: [{
            label: 'Lucro',
            data: list.map(p => p.profit),
            backgroundColor: list.map(p => p.profit >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)')
          }]
        },
        options: { scales: { y: { beginAtZero: true } } }
      });
    }

    const tbody = document.getElementById('profitabilityTable');
    if (tbody) {
      tbody.innerHTML = '';
      list.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2 pr-4">${p.name || p.id}</td>
          <td class="py-2 pr-4 text-right">${fmtCurrency(p.revenue)}</td>
          <td class="py-2 pr-4 text-right">${fmtCurrency(p.cost)}</td>
          <td class="py-2 pr-4 text-right">${fmtCurrency(p.profit)}</td>
          <td class="py-2 text-right font-semibold ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}">${(p.margin * 100).toFixed(1)}%</td>`;
        tbody.appendChild(tr);
      });
    }
  }

  // Exponha para chamadas externas e execute ao carregar
  window.renderProfitability = render;
  document.addEventListener('DOMContentLoaded', render);
})();

