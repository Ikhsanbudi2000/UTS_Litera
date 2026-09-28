// Fungsi untuk memindah tab antara Login dan Register
function gantiTab(tab) {
  if (tab === 'login') {
    document.getElementById('form-login').style.display = 'block';
    document.getElementById('form-register').style.display = 'none';
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
  } else {
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('form-register').style.display = 'block';
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.add('active');
  }
}

// Logika Proses Login
async function prosesLogin(event) {
  event.preventDefault(); // Mencegah halaman reload
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    alert('Gagal Masuk: ' + error.message);
  } else {
    alert('Berhasil Masuk!');
    window.location.href = 'dashboard.html'; // Arahkan ke halaman utama setelah login
  }
}

// Logika Proses Register & Insert Profil
async function prosesRegister(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;

  // Langkah 1: Daftarkan user ke sistem Autentikasi Supabase
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email,
    password: password,
  });

  if (authError) {
    alert('Gagal Daftar: ' + authError.message);
    return; // Hentikan proses jika gagal
  }

  // Langkah 2: Jika auth berhasil, rekam nama ke tabel public_profiles
  if (authData.user) {
    const { error: profileError } = await supabase
      .from('public_profiles')
      .insert([
        { 
          id: authData.user.id, // Menyimpan UUID dari user yang baru mendaftar
          full_name: name,
          role: 'anggota' 
        }
      ]);

    if (profileError) {
      alert('Akun terbuat, tapi gagal menyimpan profil: ' + profileError.message);
      // Catatan: Jika error ini muncul, berarti Aurel belum mengatur RLS di tabel profiles
    } else {
      alert('Pendaftaran berhasil! Silakan masuk.');
      document.getElementById('form-register').reset(); // Kosongkan form
      gantiTab('login'); // Kembalikan tampilan ke tab login
    }
  }
}