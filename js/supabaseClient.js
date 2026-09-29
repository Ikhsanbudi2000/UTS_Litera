// Dapatkan URL dan Anon Key dari dashboard Supabase > Project Settings > API
const supabaseUrl = 'https://zghmtkeiffkhpyhcxtad.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnaG10a2VpZmZraHB5aGN4dGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NjQ1MTcsImV4cCI6MjEwNjE0MDUxN30.LP18R5iU5qRo-l6muVJCgwYUMHXATB9Mhj8XptqmRdI';

function buildSupabaseClient() {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    const client = window.supabase.createClient(supabaseUrl, supabaseKey);
    window.SUPABASE_CLIENT = client;
    window.supabase = client;
    return client;
  }

  if (window.SUPABASE_CLIENT && window.SUPABASE_CLIENT.auth) {
    return window.SUPABASE_CLIENT;
  }

  return null;
}

const supabase = buildSupabaseClient();