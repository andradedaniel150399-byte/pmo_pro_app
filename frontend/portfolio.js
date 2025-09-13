async function renderGanttChart() {
  const container = document.getElementById('view-portfolio');
  if (!container) return;

  container.innerHTML = '';

  try {
    const res = await fetch('/api/allocations');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'HTTP error');

    const map = {};
    data.forEach(a => {
      const name = a.project_name || `Projeto ${a.project_id}`;
      const start = a.start_date ? new Date(a.start_date) : null;
      const end = a.end_date ? new Date(a.end_date) : start;
      if (!start || !end) return;
      if (!map[name]) map[name] = { name, start, end };
      if (start < map[name].start) map[name].start = start;
      if (end > map[name].end) map[name].end = end;
    });

    const projects = Object.values(map);
    if (!projects.length) {
      container.textContent = 'Sem alocações para exibir.';
      return;
    }

    const globalStart = projects.reduce((min, p) => p.start < min ? p.start : min, projects[0].start);
    const globalEnd = projects.reduce((max, p) => p.end > max ? p.end : max, projects[0].end);
    const total = globalEnd - globalStart || 1;

    const chart = document.createElement('div');
    chart.className = 'relative w-full';

    projects.forEach(p => {
      const left = ((p.start - globalStart) / total) * 100;
      const width = ((p.end - p.start) / total) * 100;

      const row = document.createElement('div');
      row.className = 'relative h-6 mb-2';

      const label = document.createElement('span');
      label.className = 'absolute left-0 -ml-32 w-28 text-right text-xs';
      label.textContent = p.name;
      row.appendChild(label);

      const bar = document.createElement('div');
      bar.className = 'absolute top-0 h-4 bg-indigo-500 rounded';
      bar.style.left = left + '%';
      bar.style.width = width + '%';
      bar.title = `${p.name}: ${p.start.toISOString().slice(0,10)} → ${p.end.toISOString().slice(0,10)}`;
      row.appendChild(bar);

      chart.appendChild(row);
    });

    container.appendChild(chart);
  } catch (e) {
    console.error('renderGanttChart', e);
    container.textContent = 'Erro ao carregar portfólio.';
  }
}

// render on load
if (document.readyState !== 'loading') {
  renderGanttChart();
} else {
  document.addEventListener('DOMContentLoaded', renderGanttChart);
}

export { renderGanttChart };
