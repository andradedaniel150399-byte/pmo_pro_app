// Controle de abas internas
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('block');
      });
      const el = document.getElementById(target);
      if (el) {
        el.classList.remove('hidden');
        el.classList.add('block');
      }
    });
  });
}

// Listagem de profissionais com inputs editáveis e botão Remover
async function loadTeam() {
  try {
    const r = await fetch('/api/professionals');
    const list = await r.json();
    const container = document.getElementById('team-list');
    if (!container) return;
    container.innerHTML = '';
    (list || []).forEach(p => {
      const row = document.createElement('div');
      row.className = 'flex gap-2 items-center';

      const nameInput = document.createElement('input');
      nameInput.className = 'input flex-1';
      nameInput.value = p.name || '';
      row.appendChild(nameInput);

      const emailInput = document.createElement('input');
      emailInput.className = 'input flex-1';
      emailInput.value = p.email || '';
      row.appendChild(emailInput);

      const roleInput = document.createElement('input');
      roleInput.className = 'input w-32';
      roleInput.value = p.role || '';
      row.appendChild(roleInput);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'px-3 py-2 rounded-xl bg-red-100 text-red-700 text-sm remove-prof';
      removeBtn.dataset.id = p.id;
      removeBtn.textContent = 'Remover';
      row.appendChild(removeBtn);

      container.appendChild(row);

      removeBtn.addEventListener('click', async () => {
        row.remove();
        try {
          await fetch('/api/professionals/' + p.id, { method: 'DELETE' });
        } catch (e) {
          console.error('Erro ao remover profissional', e);
        }
      });
    });
  } catch (e) {
    console.error('loadTeam', e);
  }
}

// Carrega configurações de integração do localStorage
function loadIntegration() {
  const apiEl = document.getElementById('pipefyApiKey');
  const pipeEl = document.getElementById('pipefyPipeId');
  const svcEl = document.getElementById('serviceCodes');
  if (apiEl) apiEl.value = localStorage.getItem('pipefyApiKey') || '';
  if (pipeEl) pipeEl.value = localStorage.getItem('pipefyPipeId') || '';
  if (svcEl) svcEl.value = localStorage.getItem('serviceCodes') || '';
}

function saveIntegration() {
  const apiEl = document.getElementById('pipefyApiKey');
  const pipeEl = document.getElementById('pipefyPipeId');
  const svcEl = document.getElementById('serviceCodes');
  if (apiEl) localStorage.setItem('pipefyApiKey', apiEl.value.trim());
  if (pipeEl) localStorage.setItem('pipefyPipeId', pipeEl.value.trim());
  if (svcEl) localStorage.setItem('serviceCodes', svcEl.value.trim());
}

// Botão Salvar e Sincronizar
async function handlePipefySync() {
  const btn = document.getElementById('btnSaveSync');
  try {
    if (btn) btn.disabled = true;
    const r = await fetch('/api/sync/pipefy', { method: 'POST', cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    alert(`Sincronizado: ${j.upserts ?? 0} projeto(s)`);
  } catch (e) {
    alert('Erro: ' + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.handlePipefySync = handlePipefySync;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadTeam();
  loadIntegration();

  const btnSaveSync = document.getElementById('btnSaveSync');
  if (btnSaveSync) {
    btnSaveSync.addEventListener('click', async () => {
      saveIntegration();
      await handlePipefySync();
    });
  }
});
