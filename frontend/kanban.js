async function loadKanban() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'erro ao carregar projetos');

    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';

    const groups = {};
    (data || []).forEach(p => {
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
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.textContent = p.name || p.id;
        card.dataset.id = p.id;
        cardsEl.appendChild(card);
      });

      new Sortable(cardsEl, {
        group: 'kanban',
        animation: 150,
        onEnd: evt => {
          const card = evt.item;
          const newStatus = evt.to.closest('.kanban-column').dataset.status;
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadKanban, { once: true });
} else {
  loadKanban();
}
