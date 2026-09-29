(() => {
  const supabaseUrl = 'https://zghmtkeiffkhpyhcxtad.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnaG10a2VpZmZraHB5aGN4dGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NjQ1MTcsImV4cCI6MjEwNjE0MDUxN30.LP18R5iU5qRo-l6muVJCgwYUMHXATB9Mhj8XptqmRdI';
  const supabaseLibrary = window.supabase;

  if (window.SUPABASE_CLIENT) return;

  if (!supabaseLibrary || typeof supabaseLibrary.createClient !== 'function') {
    console.error('Supabase JS library gagal dimuat.');
    return;
  }

  window.SUPABASE_CLIENT = supabaseLibrary.createClient(supabaseUrl, supabaseKey);
})();