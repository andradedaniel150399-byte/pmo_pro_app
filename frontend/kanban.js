// kanban.js - renderiza quadro kanban simples
(function () {
  const statusColors = { 'Em andamento': 'border-blue-500', 'Concluído': 'border-green-500', 'Atrasado': 'border-red-500' };

  async function renderKanban() {
    try {
      if (!window.state.db.projects.length) {
        const data = await window.fetchJSON('/api/projects');
        window.state.db.projects = data || [];
      }
      const board = document.getElementById('kanban-board');
      if (!board) return;
      board.innerHTML = '';
      const groups = {};
      (window.state.db.projects || []).forEach(p => { const s = p.status || 'Sem status'; (groups[s] = groups[s] || []).push(p); });
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
          card.addEventListener('click', () => window.openProjectModal?.(p.id));
          cardsEl.appendChild(card);
        });
        if (typeof Sortable === 'function') {
          new Sortable(cardsEl, {
            group: 'kanban', animation: 150, onEnd: evt => {
              const card = evt.item;
              const newStatus = evt.to.closest('.kanban-column').dataset.status;
              const proj = window.state.db.projects.find(pr => String(pr.id) === String(card.dataset.id));
              if (proj) proj.status = newStatus;
              fetch(`/api/projects/${card.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }).catch(console.error);
            }
          });
        }
      });
    } catch (e) { console.error('renderKanban', e); }
  }

  window.renderKanban = renderKanban;
})();
// kanban.js — renderiza o quadro Kanban usando SortableJS quando disponível
(function () {
  const statusColors = { 'Em andamento': 'border-blue-500', 'Concluído': 'border-green-500', 'Atrasado': 'border-red-500' };

  async function renderKanban() {
    try {
      if (!window.state.db.projects.length) {
        const res = await fetch('/api/projects');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'erro ao carregar projetos');
        window.state.db.projects = data || [];
      }
      const board = document.getElementById('kanban-board');
      if (!board) return;
      board.innerHTML = '';
      const groups = {};
      (window.state.db.projects || []).forEach(p => { const s = p.status || 'Sem status'; (groups[s] = groups[s] || []).push(p); });
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
          card.addEventListener('click', () => window.openProjectModal?.(p.id));
          cardsEl.appendChild(card);
        });
        if (typeof Sortable === 'function') {
          new Sortable(cardsEl, { group: 'kanban', animation: 150, onEnd: evt => {
            const card = evt.item; const newStatus = evt.to.closest('.kanban-column').dataset.status; const proj = window.state.db.projects.find(pr => String(pr.id) === String(card.dataset.id));
            if (proj) proj.status = newStatus;
            fetch(`/api/projects/${card.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }).catch(console.error);
          }});
        }
      });
    } catch (e) { console.error('renderKanban', e); }
  }

  window.renderKanban = renderKanban;
})();
