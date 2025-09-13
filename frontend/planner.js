// Gera visão de planner mensal
function renderPlannerView() {
  const monthInput = document.querySelector('input[type="month"]');
  const table = document.getElementById('planner-table');
  if (!monthInput || !table) return;

  const monthValue = monthInput.value || new Date().toISOString().slice(0, 7);
  const [year, month] = monthValue.split('-').map(n => parseInt(n, 10));
  const daysInMonth = new Date(year, month, 0).getDate();

  table.innerHTML = '';

  // Cabeçalho com dias
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const thName = document.createElement('th');
  thName.textContent = 'Profissional';
  headRow.appendChild(thName);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const th = document.createElement('th');
    th.textContent = String(d);
    if (date.getDay() === 0 || date.getDay() === 6) th.classList.add('bg-slate-200');
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const allocations = globalThis.state?.db?.allocations || [];
  const professionals = {};

  allocations.forEach(a => {
    const pid = a.professional_id ?? a.professional;
    const pname = a.professional_name ?? a.professional;
    if (pid && !professionals[pid]) professionals[pid] = pname || pid;
  });

  Object.entries(professionals).forEach(([pid, pname]) => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.textContent = pname;
    tr.appendChild(nameTd);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = document.createElement('td');
      cell.className = 'text-center text-xs';
      const dow = new Date(year, month - 1, d).getDay();
      if (dow === 0 || dow === 6) cell.classList.add('bg-slate-100');

      const dayAllocs = allocations.filter(a => (a.professional_id ?? a.professional) == pid && (a.date || a.day) === dateStr);
      if (dayAllocs.length) {
        const hard = dayAllocs.reduce((s, a) => s + (a.hard ?? a.hard_hours ?? 0), 0);
        const soft = dayAllocs.reduce((s, a) => s + (a.soft ?? a.soft_hours ?? 0), 0);
        if (hard) {
          const spanHard = document.createElement('div');
          spanHard.textContent = hard;
          spanHard.className = 'bg-red-100 text-red-700';
          cell.appendChild(spanHard);
        }
        if (soft) {
          const spanSoft = document.createElement('div');
          spanSoft.textContent = soft;
          spanSoft.className = 'bg-green-100 text-green-700';
          cell.appendChild(spanSoft);
        }
      }
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}

document.querySelector('input[type="month"]')?.addEventListener('change', renderPlannerView);
window.renderPlannerView = renderPlannerView;
