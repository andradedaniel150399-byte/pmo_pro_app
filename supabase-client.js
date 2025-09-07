(() => {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Supabase] Biblioteca não carregada. Confira a tag <script> do CDN antes deste arquivo.');
    return;
  }
  const { createClient } = window.supabase;
  const supabaseUrl = 'https://zhwzrrujseuivxolfuwh.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpod3pycnVqc2V1aXZ4b2xmdXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Nzk3MDAsImV4cCI6MjA3MjM1NTcwMH0.ksirOdbBuOziwVy9KIisyyoO35kLHzbJbh00Go6n424';
  const sb = createClient(supabaseUrl, supabaseKey);
  window.supabase = sb;
})();