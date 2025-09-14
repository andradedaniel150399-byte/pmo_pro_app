document.addEventListener('DOMContentLoaded', () => {
  const authForm = document.getElementById('auth-form');
  const authMsg = document.getElementById('auth-msg');
  const authGoogle = document.getElementById('auth-google');
  const authSubmit = document.getElementById('auth-submit');
  const tabSignin = document.getElementById('tab-signin');
  const tabSignup = document.getElementById('tab-signup');
  let mode = 'signin';

  function setMode(newMode) {
    mode = newMode;
    authMsg.textContent = '';
    if (mode === 'signin') {
      tabSignin.classList.add('active');
      tabSignup.classList.remove('active');
      authSubmit.textContent = 'Entrar';
    } else {
      tabSignup.classList.add('active');
      tabSignin.classList.remove('active');
      authSubmit.textContent = 'Criar conta';
    }
  }

  tabSignin?.addEventListener('click', () => setMode('signin'));
  tabSignup?.addEventListener('click', () => setMode('signup'));
  setMode('signin');
  checkAndRedirectIfLogged();

  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    authMsg.textContent = '';
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      authMsg.textContent = error ? 'Erro no cadastro: ' + error.message : 'Conta criada! Agora faça login.';
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) authMsg.textContent = 'Erro no login: ' + error.message;
      else window.location.replace('/');
    }
  });

  authGoogle?.addEventListener('click', async () => {
    authMsg.textContent = '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' }
    });
    if (error) {
      authMsg.textContent = (mode === 'signup' ? 'Erro no cadastro: ' : 'Erro no login: ') + error.message;
    }
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session && isOn('index.html')) window.location.replace('/');
  });
});

async function checkAndRedirectIfLogged() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && isOn('index.html')) window.location.replace('/');
}

function isOn(page) {
  return window.location.pathname.endsWith('/' + page) || window.location.pathname.endsWith(page);
}

