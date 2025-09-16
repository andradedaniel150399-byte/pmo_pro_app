// Controle principal da aplicação

class App {
  constructor() {
    this.currentSection = 'dashboard';
    this.data = {
      projects: [],
      professionals: [],
      allocations: []
    };
  }

  async init() {
    await this.loadInitialData();
    this.setupNavigation();
    this.showSection('dashboard');
  }

  async loadInitialData() {
    try {
      showNotification('Carregando dados...');
      
      const [projectsRes, professionalsRes, allocationsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/professionals'),
        fetch('/api/allocations')
      ]);

      const projectsData = await projectsRes.json();
      this.data.projects = projectsData.data || projectsData;
      this.data.professionals = await professionalsRes.json();
      this.data.allocations = await allocationsRes.json();

      showNotification('Dados carregados com sucesso!');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showNotification('Erro ao carregar dados da aplicação', 'error');
    }
  }

  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.getAttribute('href').substring(1);
        this.showSection(section);
      });
    });
  }

  showSection(sectionName) {
    // Remover classe active de todas as seções
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    
    // Remover classe active de todos os links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Ativar seção atual
    const targetSection = document.getElementById(sectionName);
    const targetLink = document.querySelector(`[href="#${sectionName}"]`);
    
    if (targetSection) {
      targetSection.classList.add('active');
    }
    
    if (targetLink) {
      targetLink.classList.add('active');
    }

    this.currentSection = sectionName;

    // Carregar dados específicos da seção
    this.loadSectionData(sectionName);
  }

  async loadSectionData(sectionName) {
    switch (sectionName) {
      case 'dashboard':
        if (window.dashboard) {
          await window.dashboard.refresh();
        }
        break;
      case 'projects':
        await this.loadProjects();
        break;
      case 'professionals':
        await this.loadProfessionals();
        break;
      case 'allocations':
        await this.loadAllocations();
        break;
    }
  }

  async loadProjects() {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      this.data.projects = result.data || result;
      this.renderProjects();
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      showNotification('Erro ao carregar projetos', 'error');
    }
  }

  async loadProfessionals() {
    try {
      const response = await fetch('/api/professionals');
      this.data.professionals = await response.json();
      this.renderProfessionals();
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      showNotification('Erro ao carregar profissionais', 'error');
    }
  }

  async loadAllocations() {
    try {
      const response = await fetch('/api/allocations');
      this.data.allocations = await response.json();
      this.renderAllocations();
      this.loadFilters();
    } catch (error) {
      console.error('Erro ao carregar alocações:', error);
      showNotification('Erro ao carregar alocações', 'error');
    }
  }

  renderProjects() {
    const tbody = document.querySelector('#projectsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = this.data.projects.map(project => `
      <tr data-id="${project.id}">
        <td>${project.name}</td>
        <td><span class="status-badge ${project.pipefy_status || 'imported'}">${this.getStatusLabel(project.pipefy_status)}</span></td>
        <td>${project.pipefy_owner_email || 'N/A'}</td>
        <td><span class="priority-badge ${project.pipefy_priority || 'medium'}">${this.getPriorityLabel(project.pipefy_priority)}</span></td>
        <td>${project.estimated_hours ? project.estimated_hours + 'h' : 'N/A'}</td>
        <td>${project.started_at ? new Date(project.started_at).toLocaleDateString('pt-BR') : 'N/A'}</td>
        <td>
          <button onclick="editProject(${project.id})" class="btn-edit">✏️</button>
          <button onclick="deleteProject(${project.id})" class="btn-delete">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  renderProfessionals() {
    const tbody = document.querySelector('#professionalsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = this.data.professionals.map(prof => `
      <tr data-id="${prof.id}">
        <td>${prof.name}</td>
        <td>${prof.role || 'N/A'}</td>
        <td>R$ ${prof.hourly_rate ? Number(prof.hourly_rate).toFixed(2) : '0.00'}</td>
        <td>R$ ${prof.cost ? Number(prof.cost).toFixed(2) : '0.00'}</td>
        <td>${prof.utilization ? (Number(prof.utilization) * 100).toFixed(1) + '%' : 'N/A'}</td>
        <td>
          <button onclick="editProfessional(${prof.id})" class="btn-edit">✏️</button>
          <button onclick="deleteProfessional(${prof.id})" class="btn-delete">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  renderAllocations() {
    const tbody = document.querySelector('#allocationsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = this.data.allocations.map(alloc => `
      <tr data-id="${alloc.id}">
        <td>${this.formatDate(alloc.date)}</td>
        <td>${alloc.project_name || `Projeto ${alloc.project_id}`}</td>
        <td>${alloc.professional_name || `Prof ${alloc.professional_id}`}</td>
        <td>${alloc.professional_role || 'N/A'}</td>
        <td>${Number(alloc.hours).toFixed(1)}h</td>
        <td>${alloc.type || 'N/A'}</td>
        <td>R$ ${this.calculateAllocationValue(alloc)}</td>
        <td>
          <button onclick="editAllocation(${alloc.id})" class="btn-edit">✏️</button>
          <button onclick="deleteAllocation(${alloc.id})" class="btn-delete">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  loadFilters() {
    // Carregar filtros de projetos
    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) {
      projectFilter.innerHTML = '<option value="">Todos os projetos</option>' +
        this.data.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    // Carregar filtros de profissionais
    const professionalFilter = document.getElementById('professionalFilter');
    if (professionalFilter) {
      professionalFilter.innerHTML = '<option value="">Todos os profissionais</option>' +
        this.data.professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
  }

  getStatusLabel(status) {
    const statusMap = {
      'imported': 'Importado',
      'in_progress': 'Em Andamento',
      'done': 'Concluído',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || 'Desconhecido';
  }

  getPriorityLabel(priority) {
    const priorityMap = {
      'low': 'Baixa',
      'medium': 'Média',
      'high': 'Alta',
      'urgent': 'Urgente'
    };
    return priorityMap[priority] || 'Média';
  }

  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  calculateAllocationValue(allocation) {
    const hours = Number(allocation.hours) || 0;
    const hourlyRate = Number(allocation.hourly_rate) || 0;
    return (hours * hourlyRate).toFixed(2);
  }
}

// Instância global da aplicação
let app;

// Funções globais para navegação
function showSection(sectionName) {
  if (app) {
    app.showSection(sectionName);
  }
}

function applyAllocationsFilter() {
  // Implementar filtro de alocações
  const projectId = document.getElementById('projectFilter').value;
  const professionalId = document.getElementById('professionalFilter').value;
  const startDate = document.getElementById('startDateFilter').value;
  const endDate = document.getElementById('endDateFilter').value;

  let filteredAllocations = [...app.data.allocations];

  if (projectId) {
    filteredAllocations = filteredAllocations.filter(a => a.project_id == projectId);
  }

  if (professionalId) {
    filteredAllocations = filteredAllocations.filter(a => a.professional_id == professionalId);
  }

  if (startDate) {
    filteredAllocations = filteredAllocations.filter(a => a.date >= startDate);
  }

  if (endDate) {
    filteredAllocations = filteredAllocations.filter(a => a.date <= endDate);
  }

  // Temporariamente substituir dados para renderização
  const originalAllocations = app.data.allocations;
  app.data.allocations = filteredAllocations;
  app.renderAllocations();
  app.data.allocations = originalAllocations;

  showNotification(`Filtro aplicado: ${filteredAllocations.length} alocações encontradas`);
}

// Inicializar aplicação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
  app.init();
  
  // Configurar dashboard como seção inicial
  const dashboardContainer = document.getElementById('dashboard-content');
  if (dashboardContainer) {
    dashboardContainer.id = 'dashboard';
    window.dashboard = new Dashboard();
    window.dashboard.init();
  }
});