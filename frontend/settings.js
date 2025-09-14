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

// Carrega configurações de integração do backend
async function loadIntegration() {
  try {
    const r = await fetch('/api/settings');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'erro');
    document.getElementById('pipefyApiKey').value = j.pipefyApiKey || '';
    document.getElementById('pipefyPipeId').value = j.pipefyPipeId || '';
    document.getElementById('serviceCodes').value = j.serviceCodes || '';
  } catch (e) {
    console.error('loadIntegration', e);
  }
}

async function saveIntegration() {
  const body = {
    pipefyApiKey: document.getElementById('pipefyApiKey').value.trim(),
    pipefyPipeId: document.getElementById('pipefyPipeId').value.trim(),
    serviceCodes: document.getElementById('serviceCodes').value.trim()
  };
  try {
    const r = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'erro');
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
    throw e;
  }
}

document.getElementById('btnSaveSync').addEventListener('click', async () => {
  try {
    await saveIntegration();
    await window.handlePipefySync?.();
  } catch (e) {
    console.error(e);
  }
});

// Inicialização
initTabs();
loadTeam();
loadIntegration();
