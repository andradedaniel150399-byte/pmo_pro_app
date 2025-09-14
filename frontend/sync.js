(() => {
  'use strict';

  async function callGeminiAPI(prompt) {
    let res;
    try {
      res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
    } catch (e) {
      throw new Error('Erro de rede ao acessar Gemini API');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(data.error || data.message || 'Falha na Gemini API');
    }
    return data.text || data.response || '';
  }

  async function regenerateSummary() {
    const el = document.getElementById('dashboard-summary');
    if (!el) return;
    try {
      const r = await fetch('/api/metrics/overview');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'erro');
      const prompt = `Faça um breve resumo executivo do portfólio de projetos com base nas métricas: total ${j.total_projects}, novos 30d ${j.projects_last_30d}, owners ${j.owners}, horas ${j.total_hours}.`;
      const txt = await callGeminiAPI(prompt);
      el.textContent = txt;
    } catch (e) {
      console.error('regenerateSummary', e);
    }
  }

  async function handlePipefySync() {
    const btn = document.getElementById('btnSync') || document.getElementById('btnSaveSync');
    try {
      if (btn) btn.disabled = true;
      const r = await fetch('/api/sync/pipefy', { method: 'POST', cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'erro');
      await window.loadProjects?.();
      await regenerateSummary();
      alert(`Sincronizado: ${j.upserts ?? 0} projeto(s)`);
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  window.handlePipefySync = handlePipefySync;
  window.regenerateSummary = regenerateSummary;

  document.getElementById('btnSync')?.addEventListener('click', handlePipefySync);
})();
