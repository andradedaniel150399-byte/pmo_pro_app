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
      el.classList.remove('hidden');
      el.classList.add('block');
    });
  });
}

// Listagem de profissionais com inputs editáveis e botão Remover
async function loadTeam() {
  try {
    const r = await fetch('/api/professionals');
    const list = await r.json();
    const container = document.getElementById('team-list');
    container.innerHTML = '';
    (list || []).forEach(p => {
      const row = document.createElement('div');
      row.className = 'flex gap-2 items-center';
      row.innerHTML = `
        <input class="input flex-1" value="${p.name || ''}" />
        <input class="input flex-1" value="${p.email || ''}" />
        <input class="input w-32" value="${p.role || ''}" />
        <button class="px-3 py-2 rounded-xl bg-red-100 text-red-700 text-sm remove-prof" data-id="${p.id}">Remover</button>
      `;
      container.appendChild(row);
      row.querySelector('.remove-prof').addEventListener('click', async () => {
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
  document.getElementById('pipefyApiKey').value = localStorage.getItem('pipefyApiKey') || '';
  document.getElementById('pipefyPipeId').value = localStorage.getItem('pipefyPipeId') || '';
  document.getElementById('serviceCodes').value = localStorage.getItem('serviceCodes') || '';
}

function saveIntegration() {
  localStorage.setItem('pipefyApiKey', document.getElementById('pipefyApiKey').value.trim());
  localStorage.setItem('pipefyPipeId', document.getElementById('pipefyPipeId').value.trim());
  localStorage.setItem('serviceCodes', document.getElementById('serviceCodes').value.trim());
}

// Botão Salvar e Sincronizar
async function handlePipefySync() {
  const btn = document.getElementById('btnSaveSync');
  try {
    btn.disabled = true;
    const r = await fetch('/api/sync/pipefy', { method: 'POST', cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    alert(`Sincronizado: ${j.upserts ?? 0} projeto(s)`);
  } catch (e) {
    alert('Erro: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}
window.handlePipefySync = handlePipefySync;

document.getElementById('btnSaveSync').addEventListener('click', async () => {
  saveIntegration();
  await handlePipefySync();
});

// Inicialização
initTabs();
loadTeam();
loadIntegration();
