const state = (window.state = window.state || { db: { projects: [], comments: [] } });

const statusColors = {
  'Em andamento': 'border-blue-500',
  'Concluído': 'border-green-500',
  'Atrasado': 'border-red-500'
};

async function loadKanban() {
  try {
    if (!state.db.projects.length) {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'erro ao carregar projetos');
      state.db.projects = data || [];
    }

    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';

    const groups = {};
    (state.db.projects || []).forEach(p => {
      const s = p.status || 'Sem status';
      (groups[s] = groups[s] || []).push(p);
    });

    Object.entries(groups).forEach(([status, items]) => {
      const col = document.createElement('div');
      col.className = 'kanban-column';
      col.dataset.status = status;
      col.innerHTML = `<div class="kanban-column-title">${status}</div><div class="kanban-column-cards"></div>`;
      board.appendChild(col);

      const cardsEl = col.querySelector('.kanban-column-cards');
      items.forEach(p => {
        const color = statusColors[p.status] || 'border-slate-300';
        const card = document.createElement('div');
        card.className = `kanban-card ${color}`;
        card.textContent = p.name || p.id;
        card.dataset.id = p.id;
        card.addEventListener('click', () => openProjectModal(p.id));
        cardsEl.appendChild(card);
      });

      new Sortable(cardsEl, {
        group: 'kanban',
        animation: 150,
        onEnd: evt => {
          const card = evt.item;
          const newStatus = evt.to.closest('.kanban-column').dataset.status;
          const proj = state.db.projects.find(pr => String(pr.id) === String(card.dataset.id));
          if (proj) proj.status = newStatus;
          fetch(`/api/projects/${card.dataset.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          }).catch(console.error);
        }
      });
    });
  } catch (e) {
    console.error('loadKanban', e);
  }
}

function renderComments(projectId) {
  return (state.db.comments || [])
    .filter(c => String(c.project_id) === String(projectId))
    .map(c => `<div class="p-2 bg-slate-100 rounded">${c.text}</div>`)
    .join('');
}

async function openProjectModal(projectId) {
  const project = (state.db.projects || []).find(p => String(p.id) === String(projectId));
  if (!project) return;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-xl p-6 max-w-lg w-full">
      <h2 class="text-lg font-semibold mb-4">${project.name || project.id}</h2>
      <div id="comments-list" class="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto">
        ${renderComments(projectId)}
      </div>
      <textarea id="comment-text" class="input mb-2" placeholder="Escreva um comentário"></textarea>
      <label class="flex items-center gap-2 mb-4">
        <input type="checkbox" id="notify-teams" />
        <span class="text-sm">Notificar no Teams</span>
      </label>
      <div class="flex justify-end gap-2">
        <button id="close-modal" class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-sm">Fechar</button>
        <button id="send-comment" class="btn-primary">Enviar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#close-modal').addEventListener('click', close);
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });

  modal.querySelector('#send-comment').addEventListener('click', async () => {
    const text = modal.querySelector('#comment-text').value.trim();
    const notify = modal.querySelector('#notify-teams').checked;
    if (!text) return;
    try {
      await callGeminiAPI({ projectId, text, notifyTeams: notify });
      state.db.comments = state.db.comments || [];
      state.db.comments.push({ project_id: projectId, text });
      const list = modal.querySelector('#comments-list');
      const div = document.createElement('div');
      div.className = 'p-2 bg-slate-100 rounded';
      div.textContent = text;
      list.appendChild(div);
      modal.querySelector('#comment-text').value = '';
    } catch (err) {
      console.error('send-comment', err);
    }
  });
}

async function callGeminiAPI(payload) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao chamar Gemini');
  return data;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadKanban, { once: true });
} else {
  loadKanban();
}

// Expose for debugging/testing
window.openProjectModal = openProjectModal;

