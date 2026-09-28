// Dapatkan URL dan Anon Key dari dashboard Supabase > Project Settings > API
const supabaseUrl = 'https://zghmtkeiffkhpyhcxtad.supabase.co';
const supabaseKey = 'sb_publishable_xW6xD-aqUQSHK1CIgd2aRg__3xNNGU1';

// Inisialisasi koneksi Supabase agar bisa dipakai di file JS lain
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);