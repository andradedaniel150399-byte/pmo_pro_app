// Adicionar função de notificação

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Funções de edição e exclusão
async function editProfessional(id) {
  try {
    const response = await fetch(`/api/professionals`);
    const professionals = await response.json();
    const professional = professionals.find(p => p.id == id);
    
    if (professional) {
      showProfessionalForm(professional);
    }
  } catch (error) {
    console.error('Erro ao carregar profissional:', error);
    showNotification('Erro ao carregar profissional', 'error');
  }
}

async function deleteProfessional(id) {
  if (!confirm('Tem certeza que deseja excluir este profissional?')) return;
  
  try {
    const response = await fetch(`/api/professionals/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Erro ao excluir');
    
    loadProfessionals();
    showNotification('Profissional excluído com sucesso!');
  } catch (error) {
    console.error('Erro:', error);
    showNotification('Erro ao excluir profissional', 'error');
  }
}

async function editAllocation(id) {
  try {
    const response = await fetch('/api/allocations');
    const allocations = await response.json();
    const allocation = allocations.find(a => a.id == id);
    
    if (allocation) {
      showAllocationForm(allocation);
    }
  } catch (error) {
    console.error('Erro ao carregar alocação:', error);
    showNotification('Erro ao carregar alocação', 'error');
  }
}

async function deleteAllocation(id) {
  if (!confirm('Tem certeza que deseja excluir esta alocação?')) return;
  
  try {
    const response = await fetch(`/api/allocations/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Erro ao excluir');
    
    loadAllocations();
    showNotification('Alocação excluída com sucesso!');
  } catch (error) {
    console.error('Erro:', error);
    showNotification('Erro ao excluir alocação', 'error');
  }
}