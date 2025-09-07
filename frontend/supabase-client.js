(() => {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Supabase] CDN não carregado antes deste arquivo.');
    return;
  }
  if (!window.env || !window.env.SUPABASE_URL || !window.env.SUPABASE_ANON_KEY) {
    console.error('[Supabase] Variáveis de ambiente não configuradas.');
    return;
  }
  const { createClient } = window.supabase;
  const client = createClient(window.env.SUPABASE_URL, window.env.SUPABASE_ANON_KEY);
  window.supabase = client;
})();