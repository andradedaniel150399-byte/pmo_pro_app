document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace('index.html');
    return;
  }
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = session.user?.email || '(sem e-mail)';
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.replace('index.html');
    });
  }
});