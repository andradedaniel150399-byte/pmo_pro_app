// Carrega lista de projetos (aba Projetos) e preenche selects usados nas alocações
async function loadProjects() {
  try {
    const r = await fetch('/api/metrics/top-projects?limit=999'); // pega ids e nomes (reuso)
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');

    // Se você quiser todos, troque por uma rota que liste /api/projects (você pode criar depois)
    // Aqui, para simplificar, uso os "top projects" só para preencher a tabela e selects.
    const tbody = document.getElementById('projects-tbody');
    const selCreate = document.getElementById('alloc-project');
    const selFilter = document.getElementById('filter-project');
    tbody.innerHTML = '';
    selCreate.innerHTML = '';
    if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';

    (j.items || []).forEach(p => {
      // tabela
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2 pr-4">${p.name ?? '-'}</td>
        <td class="py-2 pr-4">${p.id ?? '-'}</td>
        <td class="py-2 pr-4">${p.status ?? '-'}</td>
        <td class="py-2 pr-4">${p.owner_email ?? '-'}</td>
        <td class="py-2">${(p.created_at || '').slice(0,10)}</td>
      `;
      tbody.appendChild(tr);

      // selects
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      selCreate.appendChild(opt);
      if (selFilter) selFilter.appendChild(opt.cloneNode(true));
    });
  } catch (e) {
    console.error('loadProjects', e);
  }
}

async function loadProfessionals() {
  try {
    const r = await fetch('/api/professionals');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');

    const tbody = document.getElementById('professionals-tbody');
    const selCreate = document.getElementById('alloc-prof');
    const selFilter = document.getElementById('filter-prof');
    tbody.innerHTML = '';
    selCreate.innerHTML = '';
    if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';

    (j || []).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="py-2 pr-4">${p.name}</td><td class="py-2 pr-4">${p.email ?? '-'}</td><td class="py-2">${p.role ?? '-'}</td>`;
      tbody.appendChild(tr);

      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      selCreate.appendChild(opt);
      if (selFilter) selFilter.appendChild(opt.cloneNode(true));
    });
  } catch (e) {
    console.error('loadProfessionals', e);
  }
}

async function addProfessional() {
  const name = document.getElementById('prof-name').value.trim();
  const email = document.getElementById('prof-email').value.trim();
  const role = document.getElementById('prof-role').value.trim();
  if (!name) return alert('Informe o nome');

  try {
    const r = await fetch('/api/professionals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    document.getElementById('prof-name').value = '';
    document.getElementById('prof-email').value = '';
    document.getElementById('prof-role').value = '';
    await loadProfessionals();
    alert('Profissional adicionado!');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// --- autenticação/demo ---
let currentUser = null;

function updateUserUI() {
  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name');
  const userInfo = document.getElementById('user-info');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnSync = document.getElementById('btnSync');
  const btnTheme = document.getElementById('btnTheme');
  const btnPersonalize = document.getElementById('btnPersonalize');

  if (currentUser?.name) {
    if (avatarEl) avatarEl.src = currentUser.avatar;
    if (nameEl) nameEl.textContent = currentUser.name;
    userInfo?.classList.remove('hidden');
    btnLogin?.classList.add('hidden');
    btnLogout?.classList.remove('hidden');
    btnSync?.classList.remove('hidden');
    btnTheme?.classList.remove('hidden');
    btnPersonalize?.classList.remove('hidden');
  } else {
    userInfo?.classList.add('hidden');
    btnLogin?.classList.remove('hidden');
    btnLogout?.classList.add('hidden');
    btnSync?.classList.add('hidden');
    btnTheme?.classList.add('hidden');
    btnPersonalize?.classList.add('hidden');
  }
}

function loadUser() {
  try {
    currentUser = JSON.parse(localStorage.getItem('demoUser') || 'null');
  } catch {
    currentUser = null;
  }
}

function handleLogin() {
  currentUser = {
    name: 'Usuário Demo',
    avatar: `https://i.pravatar.cc/40?u=demo`
  };
  localStorage.setItem('demoUser', JSON.stringify(currentUser));
  showNotification(`Bem-vindo, ${currentUser.name}!`, 'success');
  updateUserUI();
}

function handleLogout() {
  localStorage.removeItem('demoUser');
  showNotification('Até logo!', 'info');
  currentUser = null;
  updateUserUI();
  location.href = '/';
}

// --- eventos ---
document.getElementById('btnAddProf')?.addEventListener('click', addProfessional);
document.getElementById('btnLogin')?.addEventListener('click', handleLogin);
document.getElementById('btnPersonalize')?.addEventListener('click', () => {
  location.href = '/settings.html';
});
document.getElementById('btnTheme')?.addEventListener('click', () => {
  const html = document.documentElement;
  html.classList.toggle('dark');
  localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
});

// carrega listas e estado ao abrir
loadUser();
updateUserUI();
const savedTheme = localStorage.getItem('theme');
if (savedTheme) document.documentElement.classList.toggle('dark', savedTheme === 'dark');
loadProjects();
loadProfessionals();

// expõe para o dashboard.js poder recarregar junto após sync
window.loadProjects = loadProjects;
