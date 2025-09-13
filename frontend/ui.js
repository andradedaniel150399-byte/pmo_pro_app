function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `notification notification-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
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

window.showNotification = showNotification;
window.confirmAction = confirmAction;
