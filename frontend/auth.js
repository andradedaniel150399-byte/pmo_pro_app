document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const signinForm = document.getElementById('signin-form');
  const signupMsg  = document.getElementById('signup-msg');
  const signinMsg  = document.getElementById('signin-msg');
  checkAndRedirectIfLogged();
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      signupMsg.textContent = '';
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) signupMsg.textContent = 'Erro no cadastro: ' + error.message;
      else signupMsg.textContent = 'Conta criada! Agora faça Sign In.';
    });
  }
  if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      signinMsg.textContent = '';
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) signinMsg.textContent = 'Erro no login: ' + error.message;
      else window.location.replace('app.html');
    });
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session && isOn('index.html')) window.location.replace('app.html');
  });
});
async function checkAndRedirectIfLogged() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && isOn('index.html')) window.location.replace('app.html');
}
function isOn(page) {
  return window.location.pathname.endsWith('/' + page) || window.location.pathname.endsWith(page);
}