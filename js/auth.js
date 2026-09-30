function getSupabaseClient() {
  const client = window.SUPABASE_CLIENT || null;
  return client && client.auth ? client : null;
}

function showAuthMessage(message, type = 'error') {
  const feedback = document.getElementById('auth-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.type = type;
  feedback.hidden = false;
}

async function prosesLogin(event) {
  event.preventDefault();
  const client = getSupabaseClient();
  if (!client) return showAuthMessage('Koneksi Supabase belum siap. Muat ulang halaman.');

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return showAuthMessage(error.message);
  window.location.href = 'dashboard.html';
}

async function prosesRegister(event) {
  event.preventDefault();
  const client = getSupabaseClient();
  if (!client) return showAuthMessage('Koneksi Supabase belum siap. Muat ulang halaman.');

  const fullName = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  if (error) return showAuthMessage(error.message);

  document.getElementById('form-register').reset();
  if (data.session) {
    window.location.href = 'dashboard.html';
    return;
  }
  showAuthMessage('Pendaftaran berhasil. Periksa email untuk verifikasi sebelum masuk.', 'success');
  gantiTab('login');
}

document.addEventListener('DOMContentLoaded', async () => {
  const client = getSupabaseClient();
  if (!client) return;
  const { data, error } = await client.auth.getSession();
  if (error) showAuthMessage(error.message);
  else if (data.session) window.location.href = 'dashboard.html';
});