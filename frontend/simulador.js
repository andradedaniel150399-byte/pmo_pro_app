// simulador.js — PMO Quest: jogo/sandbox para testar modificações no portfólio
// Tudo roda numa cópia em memória; nenhuma chamada de escrita é feita na API.
(function () {
  const BASE_CAP = 160;        // horas normais por mês
  const OT_EXTRA = 32;         // horas extras possíveis por mês
  const LEAVE_CAP = 80;        // capacidade em mês de licença
  const RAMP = 0.8;            // produtividade no 1º mês em um projeto novo
  const ACTIONS_PER_TURN = 3;

  const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const pct = v => `${(v * 100).toFixed(0)}%`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clone = o => JSON.parse(JSON.stringify(o));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const $ = id => document.getElementById(id);

  // ===== Dados =====
  const DEMO = {
    pros: [
      { id: 1, name: 'Ana Souza', role: 'Gerente de Projetos', rate: 140 },
      { id: 2, name: 'Bruno Lima', role: 'Dev Sênior', rate: 120 },
      { id: 3, name: 'Carla Mendes', role: 'Dev Pleno', rate: 85 },
      { id: 4, name: 'Diego Rocha', role: 'Analista de Dados', rate: 95 },
      { id: 5, name: 'Eduarda Alves', role: 'UX Designer', rate: 90 },
      { id: 6, name: 'Felipe Castro', role: 'QA', rate: 70 }
    ],
    projects: [
      { id: 1, name: 'Portal do Cliente', demand: 240, revenue: 46000 },
      { id: 2, name: 'App Mobile Vendas', demand: 220, revenue: 39000 },
      { id: 3, name: 'BI Financeiro', demand: 130, revenue: 26000 },
      { id: 4, name: 'Migração Cloud', demand: 160, revenue: 30000 },
      { id: 5, name: 'Chatbot Atendimento', demand: 80, revenue: 12000 }
    ],
    allocs: [
      [1, 1, 50], [2, 1, 50], [4, 1, 40], [3, 1, 40],
      [1, 2, 130], [4, 2, 70],
      [2, 3, 130], [5, 3, 50],
      [3, 4, 70],
      [1, 5, 40], [2, 5, 20],
      [4, 6, 30], [5, 6, 20]
    ].map(([projectId, proId, hours]) => ({ projectId, proId, hours }))
  };

  async function loadRealData() {
    const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); };
    const [prosRaw, projRes, allocsRaw] = await Promise.all([get('/api/professionals'), get('/api/projects'), get('/api/allocations')]);
    const projectsRaw = Array.isArray(projRes) ? projRes : (projRes?.data || []);
    if (!Array.isArray(prosRaw) || prosRaw.length < 2 || !projectsRaw.length) {
      throw new Error('são necessários pelo menos 2 profissionais e 1 projeto');
    }

    const pairs = new Map();
    const hoursByProject = {};
    (allocsRaw || []).forEach(a => {
      const h = Number(a.hours || 0);
      if (!h) return;
      const key = `${a.project_id}:${a.professional_id}`;
      const pair = pairs.get(key) || { projectId: a.project_id, proId: a.professional_id, hours: 0 };
      pair.hours += h;
      pairs.set(key, pair);
      hoursByProject[a.project_id] = (hoursByProject[a.project_id] || 0) + h;
    });

    const pros = prosRaw.slice(0, 15).map(p => ({
      id: p.id,
      name: p.name || `Profissional ${p.id}`,
      role: p.role || '',
      rate: Number(p.hourly_rate) || Math.round(Number(p.cost || 0) / BASE_CAP) || 100
    }));
    const avgRate = pros.reduce((t, p) => t + p.rate, 0) / pros.length;

    const isDone = p => /done|conclu/i.test(`${p.pipefy_status || ''} ${p.status || ''}`);
    const projects = projectsRaw
      .filter(p => !isDone(p))
      .sort((a, b) => (hoursByProject[b.id] || 0) - (hoursByProject[a.id] || 0))
      .slice(0, 10)
      .map(p => {
        const demand = Number(p.estimated_hours) || Math.max(hoursByProject[p.id] || 0, 80);
        const revenue = Number(p.revenue ?? p.budget ?? p.meta?.revenue) || Math.round(demand * avgRate * 1.35);
        return { id: p.id, name: p.name || `Projeto ${p.id}`, demand, revenue };
      });

    const proIds = new Set(pros.map(p => p.id));
    const projIds = new Set(projects.map(p => p.id));
    const allocs = [...pairs.values()].filter(a => projIds.has(a.projectId) && proIds.has(a.proId));

    return { pros, projects, allocs };
  }

  // ===== Modos =====
  const MISSIONS = [
    {
      id: 'sandbox', icon: '🧪', name: 'Laboratório livre', maxTurns: Infinity, events: false,
      desc: 'Sem limite de ações nem de meses e sem eventos aleatórios. Teste qualquer modificação e compare com o cenário inicial.',
      criteria: () => []
    },
    {
      id: 'incendio', icon: '🔥', name: 'Apagar incêndio', maxTurns: 4, events: true,
      desc: 'Em até 4 meses: ninguém acima da capacidade e entrega do portfólio ≥ 90%.',
      criteria: m => [
        { label: 'Ninguém sobrecarregado', ok: m.overloaded === 0, value: `${m.overloaded} pessoa(s)` },
        { label: 'Entrega ≥ 90%', ok: m.delivery >= 0.9, value: pct(m.delivery) }
      ]
    },
    {
      id: 'margem', icon: '💰', name: 'Margem de ouro', maxTurns: 6, events: true,
      desc: 'Em até 6 meses: margem do portfólio ≥ 35% com moral média ≥ 60.',
      criteria: m => [
        { label: 'Margem ≥ 35%', ok: m.margin >= 0.35, value: pct(m.margin) },
        { label: 'Moral média ≥ 60', ok: m.morale >= 60, value: m.morale.toFixed(0) }
      ]
    },
    {
      id: 'crescimento', icon: '🚀', name: 'Crescer sem quebrar', maxTurns: 6, events: true,
      desc: 'Em até 6 meses: acumule a meta de caixa sem que ninguém peça demissão.',
      criteria: (m, s) => [
        { label: `Caixa acumulado ≥ ${fmtBRL(s.cashTarget)}`, ok: s.cash >= s.cashTarget, value: fmtBRL(s.cash) },
        { label: 'Nenhum pedido de demissão', ok: s.quits === 0, value: `${s.quits}` }
      ]
    }
  ];

  // ===== Estado =====
  let state = null;
  let baseline = null;
  let currentAction = 'transfer';

  const mission = () => MISSIONS.find(m => m.id === state.mission);
  const isSandbox = () => state.mission === 'sandbox';
  const proById = id => state.pros.find(p => p.id === id);
  const projById = id => state.projects.find(p => p.id === id);

  function newGame(missionId, data) {
    state = {
      mission: missionId,
      turn: 1,
      actionsLeft: ACTIONS_PER_TURN,
      pros: data.pros.map(p => ({ ...p, morale: 75, overtime: false, leave: 0 })),
      projects: data.projects.map(p => ({ ...p, status: 'ativo' })),
      allocs: data.allocs.map(a => ({ ...a, ramp: false })),
      cash: 0, extraCost: 0, quits: 0, nextId: 1e6,
      history: [], log: [], undo: []
    };
    baseline = metrics(state);
    state.cashTarget = Math.round(Math.max(baseline.profit, baseline.revenue * 0.15) * 6 * 1.4 / 1000) * 1000;
    $('screen-start').classList.add('hidden');
    $('screen-game').classList.remove('hidden');
    render();
  }

  // ===== Modelo =====
  function metrics(s) {
    const active = new Set(s.projects.filter(p => p.status === 'ativo').map(p => p.id));
    const allocs = s.allocs.filter(a => active.has(a.projectId));

    const pros = s.pros.map(p => {
      const hours = allocs.filter(a => a.proId === p.id).reduce((t, a) => t + a.hours, 0);
      const normalCap = p.leave > 0 ? LEAVE_CAP : BASE_CAP;
      const cap = normalCap + (p.overtime ? OT_EXTRA : 0);
      const factor = hours > cap ? cap / hours : 1;
      const otHours = p.overtime ? clamp(Math.min(hours, cap) - normalCap, 0, OT_EXTRA) : 0;
      const cost = p.rate * BASE_CAP + otHours * p.rate * 1.5;
      const util = hours / normalCap;
      const overloaded = hours > cap;
      const idle = util < 0.5;
      return { ...p, hours, cap, normalCap, factor, cost, util, overloaded, idle };
    });
    const pm = Object.fromEntries(pros.map(p => [p.id, p]));

    const projects = s.projects.map(p => {
      const mine = allocs.filter(a => a.projectId === p.id);
      const allocated = mine.reduce((t, a) => t + a.hours, 0);
      const delivered = mine.reduce((t, a) => t + a.hours * (pm[a.proId]?.factor ?? 0) * (a.ramp ? RAMP : 1), 0);
      const isActive = p.status === 'ativo';
      const delivery = !isActive ? 0 : (p.demand > 0 ? Math.min(1, delivered / p.demand) : 1);
      const earned = isActive ? p.revenue * delivery : 0;
      const cost = mine.reduce((t, a) => { const pr = pm[a.proId]; return t + (pr ? pr.cost * a.hours / Math.max(pr.hours, pr.normalCap) : 0); }, 0);
      const margin = earned ? (earned - cost) / earned : (cost ? -1 : 0);
      return { ...p, allocated, delivered, delivery, earned, cost, margin, team: mine };
    });

    const activeProjects = projects.filter(p => p.status === 'ativo');
    const revenue = activeProjects.reduce((t, p) => t + p.earned, 0);
    const potential = activeProjects.reduce((t, p) => t + p.revenue, 0);
    const cost = pros.reduce((t, p) => t + p.cost, 0) + s.extraCost;
    const profit = revenue - cost;
    const margin = revenue ? profit / revenue : 0;
    const delivery = potential ? revenue / potential : 0;
    const morale = pros.length ? pros.reduce((t, p) => t + p.morale, 0) / pros.length : 0;
    const overloaded = pros.filter(p => p.overloaded).length;
    const idle = pros.filter(p => p.idle).length;
    const idleCost = pros.reduce((t, p) => t + p.cost * Math.max(0, 1 - p.hours / p.normalCap), 0);

    const scoreParts = {
      margem: clamp(margin / 0.4, 0, 1) * 35,
      entrega: delivery * 30,
      moral: morale / 100 * 20,
      equilibrio: pros.length ? (1 - (overloaded + idle) / pros.length) * 15 : 0
    };
    const score = Math.round(Object.values(scoreParts).reduce((t, v) => t + v, 0));
    return { pros, projects, revenue, cost, profit, margin, delivery, morale, overloaded, idle, idleCost, score, scoreParts };
  }

  // ===== Modificações =====
  const ACTIONS = {
    transfer: { icon: '🔀', name: 'Transferir horas' },
    adjust: { icon: '⏱️', name: 'Ajustar alocação' },
    overtime: { icon: '🌙', name: 'Hora extra' },
    rate: { icon: '💵', name: 'Reajustar taxa' },
    hire: { icon: '➕', name: 'Contratar' },
    fire: { icon: '➖', name: 'Desligar' },
    project: { icon: '📝', name: 'Renegociar projeto' }
  };

  const proOptions = (filter = () => true) => state.pros.filter(filter).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const projOptions = (filter = () => true) => state.projects.filter(filter).map(p => `<option value="${p.id}">${esc(p.name)}${p.status !== 'ativo' ? ' (pausado)' : ''}</option>`).join('');
  const field = (label, html) => `<label><span class="lbl">${label}</span>${html}</label>`;
  const select = (name, options) => `<select name="${name}" class="field">${options}</select>`;
  const input = (name, attrs) => `<input name="${name}" class="field" ${attrs} />`;

  const FORMS = {
    transfer: () => field('Projeto', select('project', projOptions(p => p.status === 'ativo'))) +
      field('De', select('from', proOptions())) + field('Para', select('to', proOptions())) +
      field('Horas', input('hours', 'type="number" min="1" step="1" value="20"')) +
      `<p class="text-xs text-slate-500">Quem entra num projeto novo rende ${pct(RAMP)} no 1º mês (curva de aprendizado).</p>`,
    adjust: () => field('Projeto', select('project', projOptions(p => p.status === 'ativo'))) +
      field('Profissional', select('pro', proOptions())) +
      field('Total de horas no projeto (0 remove)', input('hours', 'type="number" min="0" step="1" value="40"')),
    overtime: () => field('Profissional', select('pro', state.pros.map(p => `<option value="${p.id}">${esc(p.name)} — ${p.overtime ? 'desligar' : 'ligar'} hora extra</option>`).join(''))) +
      `<p class="text-xs text-slate-500">+${OT_EXTRA}h de capacidade, horas extras custam 1,5×, moral −6 por mês.</p>`,
    rate: () => field('Profissional', select('pro', proOptions())) +
      field('Variação (%)', input('pct', 'type="number" min="-30" max="30" step="1" value="10"')) +
      `<p class="text-xs text-slate-500">Aumento melhora a moral; redução derruba (2 pontos por %).</p>`,
    hire: () => field('Nome', input('name', 'type="text" placeholder="Ex.: Gabriela Nunes"')) +
      field('Cargo', input('role', 'type="text" placeholder="Ex.: Dev Pleno"')) +
      field('Taxa (R$/h)', input('rate', 'type="number" min="30" step="5" value="90"')) +
      `<p class="text-xs text-slate-500">Onboarding custa 40h da taxa neste mês. Entra sem alocação.</p>`,
    fire: () => field('Profissional', select('pro', proOptions())) +
      `<p class="text-xs text-slate-500">Rescisão custa 80h da taxa. As horas dele(a) ficam descobertas e a moral do time cai 5.</p>`,
    project: () => field('Projeto', select('project', projOptions())) +
      field('Tipo', select('kind', [
        ['aditivo', 'Aditivo: +20% escopo e +20% receita'],
        ['corte', 'Cortar escopo: −20% escopo e −12% receita'],
        ['preco', 'Reajuste de preço: +8% receita (35% de chance de recusa)'],
        ['pausar', 'Pausar / retomar projeto']
      ].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')))
  };

  function addHours(projectId, proId, delta) {
    let a = state.allocs.find(x => x.projectId === projectId && x.proId === proId);
    if (!a) { a = { projectId, proId, hours: 0, ramp: true }; state.allocs.push(a); }
    a.hours = Math.max(0, a.hours + delta);
    state.allocs = state.allocs.filter(x => x.hours > 0);
  }

  // Cada handler valida, aplica a modificação e devolve o texto do histórico.
  const HANDLERS = {
    transfer(f) {
      const project = projById(idOf(f.project)), from = proById(idOf(f.from)), to = proById(idOf(f.to));
      const hours = Number(f.hours);
      if (!project || !from || !to) throw new Error('Selecione projeto e profissionais');
      if (from.id === to.id) throw new Error('Origem e destino precisam ser diferentes');
      const current = state.allocs.find(a => a.projectId === project.id && a.proId === from.id)?.hours || 0;
      if (!(hours > 0) || hours > current) throw new Error(`${from.name} tem ${current}h em ${project.name}`);
      addHours(project.id, from.id, -hours);
      addHours(project.id, to.id, hours);
      return `Transferiu ${hours}h de ${from.name} para ${to.name} em ${project.name}`;
    },
    adjust(f) {
      const project = projById(idOf(f.project)), pro = proById(idOf(f.pro));
      const hours = Number(f.hours);
      if (!project || !pro) throw new Error('Selecione projeto e profissional');
      if (!(hours >= 0)) throw new Error('Horas inválidas');
      const current = state.allocs.find(a => a.projectId === project.id && a.proId === pro.id)?.hours || 0;
      addHours(project.id, pro.id, hours - current);
      return `Alocação de ${pro.name} em ${project.name}: ${current}h → ${hours}h`;
    },
    overtime(f) {
      const pro = proById(idOf(f.pro));
      if (!pro) throw new Error('Selecione um profissional');
      pro.overtime = !pro.overtime;
      return `${pro.overtime ? 'Ligou' : 'Desligou'} hora extra de ${pro.name}`;
    },
    rate(f) {
      const pro = proById(idOf(f.pro)), p = Number(f.pct);
      if (!pro) throw new Error('Selecione um profissional');
      if (!p || p < -30 || p > 30) throw new Error('Use uma variação entre −30% e +30% (diferente de 0)');
      const old = pro.rate;
      pro.rate = Math.round(pro.rate * (1 + p / 100));
      pro.morale = clamp(pro.morale + (p > 0 ? Math.min(20, p) : 2 * p), 0, 100);
      return `Taxa de ${pro.name}: ${fmtBRL(old)} → ${fmtBRL(pro.rate)}/h (${p > 0 ? '+' : ''}${p}%)`;
    },
    hire(f) {
      const name = String(f.name || '').trim(), rate = Number(f.rate);
      if (!name) throw new Error('Informe o nome');
      if (!(rate >= 30)) throw new Error('Taxa mínima de R$ 30/h');
      state.pros.push({ id: `n${state.nextId++}`, name, role: String(f.role || '').trim(), rate, morale: 75, overtime: false, leave: 0 });
      state.extraCost += rate * 40;
      return `Contratou ${name} (${fmtBRL(rate)}/h) — onboarding ${fmtBRL(rate * 40)}`;
    },
    fire(f) {
      const pro = proById(idOf(f.pro));
      if (!pro) throw new Error('Selecione um profissional');
      if (state.pros.length <= 1) throw new Error('A equipe não pode ficar vazia');
      const freed = state.allocs.filter(a => a.proId === pro.id).reduce((t, a) => t + a.hours, 0);
      state.pros = state.pros.filter(p => p !== pro);
      state.allocs = state.allocs.filter(a => a.proId !== pro.id);
      state.pros.forEach(p => { p.morale = clamp(p.morale - 5, 0, 100); });
      state.extraCost += pro.rate * 80;
      return `Desligou ${pro.name} — ${freed}h descobertas, rescisão ${fmtBRL(pro.rate * 80)}`;
    },
    project(f) {
      const p = projById(idOf(f.project));
      if (!p) throw new Error('Selecione um projeto');
      switch (f.kind) {
        case 'aditivo': p.demand = Math.round(p.demand * 1.2); p.revenue = Math.round(p.revenue * 1.2); return `Aditivo em ${p.name}: demanda ${p.demand}h, receita ${fmtBRL(p.revenue)}`;
        case 'corte': p.demand = Math.round(p.demand * 0.8); p.revenue = Math.round(p.revenue * 0.88); return `Corte de escopo em ${p.name}: demanda ${p.demand}h, receita ${fmtBRL(p.revenue)}`;
        case 'preco':
          if (Math.random() < 0.35) return `Cliente de ${p.name} recusou o reajuste de preço 😬`;
          p.revenue = Math.round(p.revenue * 1.08); return `Reajuste aceito em ${p.name}: receita ${fmtBRL(p.revenue)}`;
        case 'pausar': p.status = p.status === 'ativo' ? 'pausado' : 'ativo'; return `${p.status === 'ativo' ? 'Retomou' : 'Pausou'} ${p.name}`;
        default: throw new Error('Tipo inválido');
      }
    }
  };

  // ids de projetos/profissionais podem ser número (API/demo) ou string (contratados no jogo)
  function idOf(v) { return /^\d+$/.test(String(v)) ? Number(v) : v; }

  function applyAction(type, formData) {
    if (!isSandbox() && state.actionsLeft <= 0) return toast('Sem ações neste mês — encerre o mês para continuar', 'error');
    const snapshot = clone({ ...state, undo: [] });
    try {
      const before = metrics(state).score;
      const text = HANDLERS[type](formData);
      state.undo.push(snapshot);
      if (!isSandbox()) state.actionsLeft--;
      const delta = metrics(state).score - before;
      state.log.unshift({ turn: state.turn, text, delta });
      render();
      toast(`${text} (score ${delta >= 0 ? '+' : ''}${delta})`, delta >= 0 ? 'ok' : 'warn');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function undo() {
    const prev = state.undo.pop();
    if (!prev) return toast('Nada para desfazer neste mês', 'error');
    const rest = state.undo;
    state = { ...prev, undo: rest };
    render();
  }

  // ===== Virada de mês =====
  const EVENTS = [
    s => { const p = pick(s.projects.filter(x => x.status === 'ativo')); if (!p) return null; p.demand = Math.round(p.demand * 1.2); p.revenue = Math.round(p.revenue * 1.12); return `📈 O cliente de ${p.name} pediu escopo extra: demanda +20%, receita +12%.`; },
    s => { const p = pick(s.pros); if (!p) return null; p.leave = 1; return `🤒 ${p.name} vai tirar licença médica no próximo mês (capacidade ${LEAVE_CAP}h).`; },
    s => { const p = pick(s.pros); if (!p) return null; p.morale = clamp(p.morale - 20, 0, 100); return `📨 ${p.name} recebeu proposta de um concorrente (moral −20). Um reajuste pode segurar.`; },
    s => { const m = metrics(s); const p = pick(m.projects.filter(x => x.status === 'ativo' && x.delivery >= 0.95)); if (!p) return null; projById(p.id).revenue = Math.round(p.revenue * 1.08); return `🌟 Cliente de ${p.name} adorou as entregas: receita +8%.`; },
    s => { const p = pick(s.projects.filter(x => x.status === 'ativo')); if (!p) return null; p.revenue = Math.round(p.revenue * 0.9); return `✂️ Corte de orçamento em ${p.name}: receita −10%.`; },
    s => { s.pros.forEach(p => { p.morale = clamp(p.morale + 5, 0, 100); }); return '🎉 Happy hour do time: moral de todos +5.'; },
    () => null
  ];

  function endTurn() {
    const m = metrics(state);
    const closedTurn = state.turn;
    state.cash += m.profit;
    state.history.push({ turn: closedTurn, score: m.score, profit: m.profit });
    const notes = [`Lucro do mês: <b>${fmtBRL(m.profit)}</b> (margem ${pct(m.margin)}) · score ${m.score}`];

    // moral
    m.pros.forEach(pm => {
      const p = proById(pm.id);
      let d = 0;
      if (pm.overloaded) d -= 15;
      if (p.overtime) d -= 6;
      if (!pm.overloaded && pm.util >= 0.6 && pm.util <= 1) d += 4;
      if (pm.idle) d -= 4;
      p.morale = clamp(p.morale + d, 0, 100);
    });

    // demissões por moral baixa
    state.pros.filter(p => p.morale < 25 && Math.random() < 0.5).forEach(p => {
      if (state.pros.length <= 1) return;
      state.pros = state.pros.filter(x => x !== p);
      state.allocs = state.allocs.filter(a => a.proId !== p.id);
      state.quits++;
      notes.push(`🚪 ${esc(p.name)} pediu demissão por moral baixa.`);
    });

    // reset do mês
    state.allocs.forEach(a => { a.ramp = false; });
    state.pros.forEach(p => { p.leave = Math.max(0, p.leave - 1); });
    state.extraCost = 0;

    if (mission().events) notes.push(esc(pick(EVENTS)(state) || '😌 Mês tranquilo, sem surpresas.'));

    state.turn++;
    state.actionsLeft = ACTIONS_PER_TURN;
    state.undo = [];

    const crit = mission().criteria(m, state);
    const won = crit.length > 0 && crit.every(c => c.ok);
    if (won) return finish(true, notes);
    if (state.turn > mission().maxTurns) return finish(false, notes);

    render();
    showModal(`<h2 class="text-lg font-bold mb-2">Fim do mês ${closedTurn}</h2><ul class="text-sm space-y-2">${notes.map(n => `<li>${n}</li>`).join('')}</ul>`,
      [{ label: 'Próximo mês', primary: true }]);
  }

  function finish(won, notes) {
    const hist = state.history;
    const avg = hist.reduce((t, h) => t + h.score, 0) / (hist.length || 1);
    const bonus = won ? 20 + 5 * Math.max(0, mission().maxTurns - hist.length) : 0;
    const final = Math.round(avg + bonus);
    const key = `pmoquest.best.${state.mission}`;
    let best = 0;
    try { best = Number(localStorage.getItem(key)) || 0; if (final > best) localStorage.setItem(key, String(final)); } catch (_) { /* storage indisponível */ }
    state.over = true;
    render();
    const record = final > best ? '🏆 Novo recorde!' : `Recorde: ${best}`;
    showModal(`
      <h2 class="text-xl font-bold mb-1">${won ? '✅ Missão cumprida!' : '⌛ Fim de jogo'}</h2>
      <p class="text-sm text-slate-600 mb-3">${won ? `Objetivo atingido em ${hist.length} mês(es).` : 'O prazo acabou antes do objetivo ser atingido.'}</p>
      <div class="text-4xl font-bold text-indigo-600">${final} pts</div>
      <p class="text-xs text-slate-500 mb-3">Média dos meses ${avg.toFixed(0)} + bônus ${bonus} · ${record}</p>
      <p class="text-sm">Caixa acumulado: <b>${fmtBRL(state.cash)}</b> · Modificações feitas: <b>${state.log.length}</b></p>
      <ul class="text-xs text-slate-600 mt-3 space-y-1">${notes.map(n => `<li>${n}</li>`).join('')}</ul>`,
    [{ label: 'Ver tabuleiro' }, { label: 'Jogar de novo', primary: true, onClick: backToStart }]);
  }

  // ===== Render =====
  function render() {
    const m = metrics(state);
    const ms = mission();
    $('g-mission').textContent = `${ms.icon} ${ms.name}`;
    $('g-turn').textContent = isSandbox()
      ? `Mês ${state.turn} · caixa acumulado ${fmtBRL(state.cash)}`
      : `Mês ${Math.min(state.turn, ms.maxTurns)} de ${ms.maxTurns} · caixa acumulado ${fmtBRL(state.cash)}`;
    $('g-score').textContent = m.score;
    $('g-actions').textContent = isSandbox() ? '(ilimitadas)' : `(${state.actionsLeft} de ${ACTIONS_PER_TURN} neste mês)`;
    $('btn-end-turn').disabled = !!state.over;
    $('btn-end-turn').classList.toggle('opacity-50', !!state.over);

    renderKpis(m);
    renderGoal(m);
    renderTeam(m);
    renderProjects(m);
    renderActions();
    renderHints(m);
    renderChart(m);
    renderLog();
  }

  function renderKpis(m) {
    const kpi = (label, val, base, fmt, higherIsBetter = true) => {
      const d = val - base;
      const good = higherIsBetter ? d > 0 : d < 0;
      const deltaTxt = Math.abs(d) < 1e-9 ? '<span class="text-slate-400">= início</span>'
        : `<span class="${good ? 'text-green-600' : 'text-red-600'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}</span>`;
      return `<div class="card !p-3"><div class="text-xs text-slate-500">${label}</div><div class="text-lg font-bold">${fmt(val)}</div><div class="text-xs">${deltaTxt}</div></div>`;
    };
    const num = v => v.toFixed(0);
    $('g-kpis').innerHTML = [
      kpi('Receita', m.revenue, baseline.revenue, fmtBRL),
      kpi('Custo', m.cost, baseline.cost, fmtBRL, false),
      kpi('Lucro', m.profit, baseline.profit, fmtBRL),
      kpi('Margem', m.margin, baseline.margin, pct),
      kpi('Entrega', m.delivery, baseline.delivery, pct),
      kpi('Moral média', m.morale, baseline.morale, num),
      kpi('Sobrecarregados', m.overloaded, baseline.overloaded, num, false),
      kpi('Ociosos (<50%)', m.idle, baseline.idle, num, false)
    ].join('');
  }

  function renderGoal(m) {
    const crit = mission().criteria(m, state);
    const parts = Object.entries(m.scoreParts).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' · ');
    $('g-goal').innerHTML = `
      <p class="text-slate-600 mb-2">${esc(mission().desc)}</p>
      ${crit.length ? `<ul class="space-y-1 mb-2">${crit.map(c => `<li>${c.ok ? '✅' : '⬜'} ${esc(c.label)} <span class="text-slate-500">— agora: ${esc(c.value)}</span></li>`).join('')}</ul>` : ''}
      <p class="text-xs text-slate-500">Score (0–100) = ${parts}. O objetivo é avaliado ao encerrar cada mês.</p>`;
  }

  function renderTeam(m) {
    $('g-team').innerHTML = m.pros.map(p => {
      const w = clamp(p.hours / p.cap, 0, 1) * 100;
      const color = p.overloaded ? 'bg-red-500' : p.idle ? 'bg-amber-400' : p.hours > p.normalCap ? 'bg-violet-500' : 'bg-emerald-500';
      const tags = [
        p.overloaded ? '<span class="text-red-600">sobrecarga</span>' : '',
        p.idle ? '<span class="text-amber-600">ocioso</span>' : '',
        p.overtime ? '<span class="text-violet-600">hora extra</span>' : '',
        p.leave > 0 ? '<span class="text-sky-600">licença</span>' : ''
      ].filter(Boolean).join(' · ') || '<span class="text-emerald-600">ok</span>';
      const moraleColor = p.morale < 40 ? 'text-red-600' : p.morale < 60 ? 'text-amber-600' : 'text-emerald-600';
      return `<tr class="border-t">
        <td class="py-2 pr-3"><div class="font-medium">${esc(p.name)}</div><div class="text-xs text-slate-500">${esc(p.role)}</div></td>
        <td class="py-2 pr-3">${p.rate}</td>
        <td class="py-2 pr-3"><div class="bar"><div class="${color}" style="width:${w}%"></div></div><div class="text-xs text-slate-500">${p.hours}h / ${p.cap}h (${pct(p.util)})</div></td>
        <td class="py-2 pr-3 font-semibold ${moraleColor}">${p.morale.toFixed(0)}</td>
        <td class="py-2 text-xs">${tags}</td>
      </tr>`;
    }).join('');
  }

  function renderProjects(m) {
    const names = Object.fromEntries(state.pros.map(p => [p.id, p.name.split(' ')[0]]));
    $('g-projects').innerHTML = m.projects.map(p => {
      const paused = p.status !== 'ativo';
      const color = p.delivery >= 0.9 ? 'bg-emerald-500' : p.delivery >= 0.7 ? 'bg-amber-400' : 'bg-red-500';
      const team = p.team.map(a => `${esc(names[a.proId] || '?')} ${a.hours}h${a.ramp ? '*' : ''}`).join(', ') || '<span class="text-red-600">sem equipe</span>';
      return `<tr class="border-t ${paused ? 'opacity-50' : ''}">
        <td class="py-2 pr-3 font-medium">${esc(p.name)}${paused ? ' <span class="text-xs text-slate-500">(pausado)</span>' : ''}</td>
        <td class="py-2 pr-3">${p.demand}h</td>
        <td class="py-2 pr-3"><div class="bar"><div class="${color}" style="width:${p.delivery * 100}%"></div></div><div class="text-xs text-slate-500">${p.delivered.toFixed(0)}h entregues (${pct(p.delivery)})</div></td>
        <td class="py-2 pr-3 text-right">${fmtBRL(p.earned)}<div class="text-xs text-slate-400">de ${fmtBRL(p.revenue)}</div></td>
        <td class="py-2 pr-3 text-right font-semibold ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}">${paused ? '—' : pct(p.margin)}</td>
        <td class="py-2 text-xs text-slate-600">${team}</td>
      </tr>`;
    }).join('') + `<tr><td colspan="6" class="pt-2 text-xs text-slate-500">* em curva de aprendizado (rende ${pct(RAMP)} neste mês) · custo de ociosidade: ${fmtBRL(m.idleCost)}</td></tr>`;
  }

  function renderActions() {
    $('action-types').innerHTML = Object.entries(ACTIONS).map(([k, a]) =>
      `<button type="button" data-action="${k}" class="action-btn ${k === currentAction ? 'active' : ''} text-left text-sm px-3 py-2 rounded-xl border border-slate-200 hover:border-indigo-400">${a.icon} ${a.name}</button>`).join('');
    const disabled = state.over || (!isSandbox() && state.actionsLeft <= 0);
    const form = $('action-form');
    // mantém as escolhas do formulário entre renders da mesma modificação
    const kept = form.dataset.action === currentAction && currentAction !== 'hire' ? Object.fromEntries(new FormData(form)) : {};
    form.dataset.action = currentAction;
    form.innerHTML = FORMS[currentAction]() +
      `<button type="submit" class="mt-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}" ${disabled ? 'disabled' : ''}>Aplicar modificação</button>`;
    Object.entries(kept).forEach(([name, value]) => {
      const el = form.elements[name];
      if (el && (el.tagName !== 'SELECT' || [...el.options].some(o => o.value === value))) el.value = value;
    });
  }

  function renderHints(m) {
    const hints = [];
    const over = [...m.pros].filter(p => p.overloaded || p.hours > p.normalCap).sort((a, b) => (b.hours - b.cap) - (a.hours - a.cap))[0];
    const idle = [...m.pros].sort((a, b) => a.util - b.util)[0];
    if (over && idle && idle.id !== over.id && idle.util < 0.85) {
      const h = Math.round(Math.min(over.hours - over.normalCap, idle.normalCap - idle.hours) / 10) * 10;
      if (h > 0) hints.push(`${esc(over.name)} está com ${over.hours}h e ${esc(idle.name)} com ${idle.hours}h: transferir ~${h}h equilibra a carga.`);
    }
    const weak = m.projects.filter(p => p.status === 'ativo' && p.delivery < 0.85).sort((a, b) => a.delivery - b.delivery)[0];
    if (weak) hints.push(`${esc(weak.name)} entrega só ${pct(weak.delivery)} — faltam ~${Math.ceil(weak.demand - weak.delivered)}h. Aloque mais gente ou corte escopo.`);
    const loss = m.projects.find(p => p.status === 'ativo' && p.margin < 0);
    if (loss) hints.push(`${esc(loss.name)} dá prejuízo: experimente reajuste de preço, aditivo ou pausar.`);
    const sad = m.pros.filter(p => p.morale < 40).sort((a, b) => a.morale - b.morale)[0];
    if (sad) hints.push(`Moral de ${esc(sad.name)} em ${sad.morale.toFixed(0)}: risco de demissão abaixo de 25. Reajuste ou alivie a carga.`);
    if (m.idle >= 2) hints.push(`${m.idle} pessoas ociosas custam ${fmtBRL(m.idleCost)} sem gerar receita.`);
    $('g-hints').innerHTML = (hints.length ? hints.slice(0, 3) : ['Portfólio equilibrado. Teste um aditivo ou reajuste de preço para crescer.']).map(h => `<li>${h}</li>`).join('');
  }

  function renderChart(m) {
    const pts = [...state.history.map(h => h.score), ...(state.over ? [] : [m.score])];
    if (pts.length < 2) { $('g-chart').innerHTML = `<p class="text-xs text-slate-500">Encerre o primeiro mês para ver a evolução. Score inicial: ${baseline.score}.</p>`; return; }
    const W = 280, H = 80, step = W / (pts.length - 1);
    const xy = pts.map((v, i) => `${(i * step).toFixed(1)},${(H - v / 100 * H).toFixed(1)}`);
    $('g-chart').innerHTML = `<svg viewBox="-4 -4 ${W + 8} ${H + 8}" class="w-full h-24">
      <line x1="0" x2="${W}" y1="${H - baseline.score / 100 * H}" y2="${H - baseline.score / 100 * H}" stroke="#cbd5e1" stroke-dasharray="4 4" />
      <polyline points="${xy.join(' ')}" fill="none" stroke="#4f46e5" stroke-width="2.5" />
      ${xy.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="#4f46e5" />`).join('')}
    </svg><p class="text-xs text-slate-500">Linha tracejada = score inicial (${baseline.score}).</p>`;
  }

  function renderLog() {
    $('g-log').innerHTML = state.log.length
      ? state.log.map(l => `<li><span class="text-slate-400">M${l.turn}</span> ${esc(l.text)} <span class="${l.delta >= 0 ? 'text-green-600' : 'text-red-600'}">(${l.delta >= 0 ? '+' : ''}${l.delta})</span></li>`).join('')
      : '<li class="text-slate-500">Nenhuma modificação ainda.</li>';
  }

  // ===== UI util =====
  let toastTimer = null;
  function toast(msg, kind = 'ok') {
    const el = $('toast');
    el.textContent = msg;
    el.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-white text-sm shadow-lg z-50 ${kind === 'error' ? 'bg-red-600' : kind === 'warn' ? 'bg-amber-600' : 'bg-emerald-600'}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
  }

  function showModal(html, buttons) {
    $('modal-body').innerHTML = html;
    const actions = $('modal-actions');
    actions.innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.className = b.primary ? 'px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm' : 'px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-sm';
      btn.addEventListener('click', () => { $('modal').classList.add('hidden'); b.onClick?.(); });
      actions.appendChild(btn);
    });
    $('modal').classList.remove('hidden');
  }

  function backToStart() {
    state = null;
    $('screen-game').classList.add('hidden');
    $('screen-start').classList.remove('hidden');
    renderMissionList();
  }

  function renderMissionList() {
    $('mission-list').innerHTML = MISSIONS.map(ms => {
      let best = 0;
      try { best = Number(localStorage.getItem(`pmoquest.best.${ms.id}`)) || 0; } catch (_) { /* storage indisponível */ }
      return `<button data-mission="${ms.id}" class="card text-left hover:border-indigo-400 hover:shadow">
        <div class="text-lg font-semibold">${ms.icon} ${ms.name}</div>
        <p class="text-sm text-slate-600 mt-1">${esc(ms.desc)}</p>
        <p class="text-xs text-slate-500 mt-2">${ms.id === 'sandbox' ? 'Sem pontuação final' : `${ms.maxTurns} meses · ${ACTIONS_PER_TURN} ações/mês · eventos aleatórios${best ? ` · recorde ${best}` : ''}`}</p>
      </button>`;
    }).join('');
  }

  async function startMission(missionId) {
    const source = document.querySelector('input[name="source"]:checked')?.value;
    if (source !== 'real') return newGame(missionId, clone(DEMO));
    $('source-msg').textContent = 'Carregando dados da API…';
    try {
      const data = await loadRealData();
      $('source-msg').textContent = '';
      newGame(missionId, data);
    } catch (e) {
      $('source-msg').textContent = `Não deu para usar seus dados (${e.message}). Iniciando com o cenário demo.`;
      toast('Usando cenário demo', 'warn');
      newGame(missionId, clone(DEMO));
    }
  }

  // ===== Eventos =====
  document.addEventListener('DOMContentLoaded', () => {
    renderMissionList();
    $('mission-list').addEventListener('click', e => {
      const btn = e.target.closest('[data-mission]');
      if (btn) startMission(btn.dataset.mission);
    });
    $('action-types').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      currentAction = btn.dataset.action;
      renderActions();
    });
    $('action-form').addEventListener('submit', e => {
      e.preventDefault();
      applyAction(currentAction, Object.fromEntries(new FormData(e.target)));
    });
    $('btn-undo').addEventListener('click', undo);
    $('btn-end-turn').addEventListener('click', () => { if (!state.over) endTurn(); });
    $('btn-restart').addEventListener('click', () => {
      showModal('<p>Sair da partida atual? O progresso será perdido.</p>', [{ label: 'Continuar jogando' }, { label: 'Sair', primary: true, onClick: backToStart }]);
    });
  });

  // exposto para testes manuais no console
  window.pmoQuest = { metrics: () => state && metrics(state), DEMO };
})();
