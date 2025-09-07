(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    profile: {},
    integrations: {},
    preferences: {
      enabledCards: {},
      customFields: [],
      accessList: []
    }
  };

  function bindSubtabs() {
    $$('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.subtab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.subtab;
        $$('.subtab-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById(target)?.classList.remove('hidden');
      });
    });
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      Object.assign(state, data);
      $('#profile-name').value = state.profile?.name || '';
      $('#profile-email').value = state.profile?.email || '';
      $('#int-pipefy-token').value = state.integrations?.pipefyToken || '';
      $('#int-supabase-url').value = state.integrations?.supabaseUrl || '';
      $('#int-supabase-key').value = state.integrations?.supabaseKey || '';
      $('#pref-card-dashboard').checked = state.preferences?.enabledCards?.dashboard !== false;
      $('#pref-card-projects').checked = state.preferences?.enabledCards?.projects !== false;
      $('#pref-card-professionals').checked = state.preferences?.enabledCards?.professionals !== false;
      $('#pref-card-allocations').checked = state.preferences?.enabledCards?.allocations !== false;
      $('#pref-form-fields').value = (state.preferences?.customFields || []).join(', ');
      $('#pref-access-list').value = (state.preferences?.accessList || []).join(', ');
      applyCardPreferences();
    } catch (e) {
      console.error('loadSettings', e);
    }
  }

  function gatherSettings() {
    return {
      profile: {
        name: $('#profile-name').value.trim(),
        email: $('#profile-email').value.trim()
      },
      integrations: {
        pipefyToken: $('#int-pipefy-token').value.trim(),
        supabaseUrl: $('#int-supabase-url').value.trim(),
        supabaseKey: $('#int-supabase-key').value.trim()
      },
      preferences: {
        enabledCards: {
          dashboard: $('#pref-card-dashboard').checked,
          projects: $('#pref-card-projects').checked,
          professionals: $('#pref-card-professionals').checked,
          allocations: $('#pref-card-allocations').checked
        },
        customFields: $('#pref-form-fields').value.split(',').map(s => s.trim()).filter(Boolean),
        accessList: $('#pref-access-list').value.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
      }
    };
  }

  async function saveSettings() {
    try {
      const data = gatherSettings();
      Object.assign(state, data);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'erro');
      alert('Configurações salvas!');
      applyCardPreferences();
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    }
  }

  function applyCardPreferences() {
    const cards = state.preferences?.enabledCards || {};
    const map = {
      dashboard: 'tab-dashboard',
      projects: 'tab-projects',
      professionals: 'tab-professionals',
      allocations: 'tab-allocations'
    };
    Object.entries(map).forEach(([key, id]) => {
      const show = cards[key] !== false;
      const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
      const panel = document.getElementById(id);
      if (btn) btn.classList.toggle('hidden', !show);
      if (panel) panel.classList.toggle('hidden', !show);
    });
  }

  function init() {
    bindSubtabs();
    loadSettings();
    $('#btnSaveProfile')?.addEventListener('click', saveSettings);
    $('#btnSaveIntegrations')?.addEventListener('click', saveSettings);
    $('#btnSavePreferences')?.addEventListener('click', saveSettings);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
