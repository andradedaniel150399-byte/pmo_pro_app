// API helpers (fetchJSON, callGeminiAPI)
(function () {
  async function fetchJSON(url, opts = {}) {
    const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText || `HTTP ${r.status}`);
    return data;
  }

  async function callGeminiAPI(payload) {
    const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || 'Erro ao chamar Gemini');
    return data;
  }

  window.fetchJSON = fetchJSON;
  window.callGeminiAPI = callGeminiAPI;
})();
