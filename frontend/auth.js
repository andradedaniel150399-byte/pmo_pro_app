// Utilitários de autenticação reutilizáveis

// Inclui automaticamente o token nas chamadas fetch
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    init.headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
  }
  return originalFetch(input, init);
};

async function handleSession(session) {
  if (!session) return;
  localStorage.setItem('access_token', session.access_token);
  localStorage.setItem('refresh_token', session.refresh_token);
  if (window.state) {
    state.currentUser = session.user;
    if (typeof updateUserUI === 'function') updateUserUI();
  }
}

async function startSession(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await handleSession(data.session);
  return data.session;
}

async function endSession() {
  await supabase.auth.signOut();
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  if (window.state) {
    state.currentUser = null;
    if (typeof updateUserUI === 'function') updateUserUI();
  }
}

async function restoreSession() {
  const { data: { session } } = await supabase.auth.getSession();
  await handleSession(session);
  return session;
}

window.startSession = startSession;
window.endSession = endSession;
window.restoreSession = restoreSession;

// Código específico para a página de autenticação
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
      try {
        await startSession(email, password);
        window.location.replace('app.html');
      } catch (error) {
        authMsg.textContent = 'Erro no login: ' + error.message;
      }
    }
  });

  authGoogle?.addEventListener('click', async () => {
    authMsg.textContent = '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/app.html' }
    });
    if (error) {
      authMsg.textContent = (mode === 'signup' ? 'Erro no cadastro: ' : 'Erro no login: ') + error.message;
    }
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session && isOn('index.html')) window.location.replace('app.html');
  });
});

async function checkAndRedirectIfLogged() {
  const session = await restoreSession();
  if (session && isOn('index.html')) window.location.replace('app.html');
}

function isOn(page) {
  return window.location.pathname.endsWith('/' + page) || window.location.pathname.endsWith(page);
}

