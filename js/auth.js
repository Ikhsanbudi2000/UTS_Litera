function getSupabaseClient() {
  const client = window.SUPABASE_CLIENT || null;
  return client && client.auth ? client : null;
}

function showAuthError(message) {
  alert(message);
}

async function saveProfileIfPossible(userId, fullName) {
  const client = getSupabaseClient();
  if (!client || !userId) return;

  const profileCandidates = ['profiles', 'public_profiles'];

  for (const tableName of profileCandidates) {
    try {
      const { error } = await client.from(tableName).insert([
        {
          id: userId,
          full_name: fullName,
          role: 'anggota'
        }
      ]);

      if (!error) return;
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('column')) continue;
      console.warn('Profile insert warning:', error.message);
      return;
    } catch (err) {
      console.warn('Profile save skipped:', err.message);
      return;
    }
  }
}

async function prosesLogin(event) {
  event.preventDefault();

  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.signInWithPassword !== 'function') {
    alert('Supabase belum siap. Cek koneksi project Anda.');
    return;
  }

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    alert('Gagal Masuk: ' + error.message);
    return;
  }

  alert('Berhasil Masuk!');
  window.location.href = 'dashboard.html';
}

async function prosesRegister(event) {
  event.preventDefault();

  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.signUp !== 'function') {
    alert('Supabase belum siap. Cek koneksi project Anda.');
    return;
  }

  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  const { data: authData, error: authError } = await client.auth.signUp({
    email,
    password,
  });

  if (authError) {
    alert('Gagal Daftar: ' + authError.message);
    return;
  }

  if (authData && authData.user) {
    await saveProfileIfPossible(authData.user.id, name || 'Anggota Baru');
    alert('Pendaftaran berhasil! Silakan masuk.');
    document.getElementById('form-register').reset();
    gantiTab('login');
  }
}

async function cekSessionSaatMuat() {
  const client = getSupabaseClient();
  if (!client || !client.auth) return;

  const { data: { session }, error } = await client.auth.getSession();
  if (!error && session) {
    window.location.href = 'dashboard.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  cekSessionSaatMuat();
});