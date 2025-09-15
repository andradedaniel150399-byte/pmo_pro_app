// Enhanced notification system
function showNotification(message, type = 'info', duration = 4000) {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'fixed top-4 right-4 z-50 space-y-2';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  
  const notification = document.createElement('div');
  const typeClasses = {
    success: 'bg-green-100 border-green-500 text-green-700',
    error: 'bg-red-100 border-red-500 text-red-700', 
    warning: 'bg-yellow-100 border-yellow-500 text-yellow-700',
    info: 'bg-blue-100 border-blue-500 text-blue-700'
  };
  
  const icons = {
    success: '✓',
    error: '✕', 
    warning: '⚠',
    info: 'ℹ'
  };
  
  notification.className = `p-3 border-l-4 rounded shadow-lg transform transition-all duration-300 translate-x-full opacity-0 ${typeClasses[type] || typeClasses.info}`;
  notification.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <span class="font-bold mr-2">${icons[type] || icons.info}</span>
        <span>${message}</span>
      </div>
      <button class="ml-4 text-lg leading-none hover:opacity-70" onclick="this.parentElement.parentElement.remove()">&times;</button>
    </div>
  `;
  
  container.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.remove('translate-x-full', 'opacity-0');
  }, 10);
  
  // Auto dismiss
  setTimeout(() => {
    notification.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 300);
  }, duration);
}

function confirmAction(message, onConfirm, onCancel) {
  const modal = document.getElementById('confirmation-modal');
  const msgEl = document.getElementById('confirmation-message');
  const yesBtn = document.getElementById('confirm-yes');
  const noBtn = document.getElementById('confirm-no');
  if (!modal || !msgEl || !yesBtn || !noBtn) {
    if (confirm(message)) {
      onConfirm && onConfirm();
    } else {
      onCancel && onCancel();
    }
    return;
  }
  msgEl.textContent = message;
  modal.classList.remove('hidden');
  function cleanup() {
    modal.classList.add('hidden');
    yesBtn.removeEventListener('click', yesHandler);
    noBtn.removeEventListener('click', noHandler);
  }
  async function yesHandler() {
    cleanup();
    await onConfirm?.();
  }
  function noHandler() {
    cleanup();
    onCancel?.();
  }
  yesBtn.addEventListener('click', yesHandler);
  noBtn.addEventListener('click', noHandler);
}
function handleLogout() {
  localStorage.removeItem('demoUser');
  showNotification('Até logo!', 'info');
  if (typeof currentUser !== 'undefined') currentUser = null;
  if (typeof updateUserUI === 'function') updateUserUI();
  location.href = '/';
}

window.showNotification = showNotification;
window.confirmAction = confirmAction;
window.handleLogout = handleLogout;

// Additional UI utilities
window.debounce = function(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Initialize keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Escape to close modals
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('#modal-prof:not(.hidden)');
    if (activeModal && typeof window.closeProfessionalModal === 'function') {
      window.closeProfessionalModal();
    }
  }
});
