# Litera

Litera adalah aplikasi perpustakaan digital berbasis HTML, CSS, dan JavaScript. Aplikasi menggunakan Supabase untuk autentikasi, katalog buku, profil anggota, transaksi peminjaman, kontrol akses berbasis role, dan pembaruan data realtime.

## Fitur

- Pengunjung dapat melihat ringkasan dan katalog buku.
- Anggota dapat mendaftar, masuk, melihat katalog, mengajukan peminjaman, dan melihat riwayat peminjamannya sendiri.
- Admin dapat mengelola judul dan stok buku, melihat seluruh transaksi, mengubah status peminjaman, menghapus catatan transaksi, serta mengelola role profil.
- Peminjaman diproses melalui fungsi database `proses_transaksi` yang memvalidasi stok secara atomik.
- Pengembalian diproses melalui `set_transaction_status`; stok dikembalikan satu kali ketika transaksi berubah menjadi `sudah dikembalikan`.
- Perubahan katalog, transaksi, dan profil disegarkan melalui Supabase Realtime.
- Row Level Security (RLS) membatasi data dan operasi sesuai role.

## Teknologi

- HTML, CSS, dan JavaScript tanpa proses build.
- Supabase Auth, PostgreSQL, RPC, RLS, dan Realtime.
- Supabase JavaScript v2 dari CDN.

Tidak ada `package.json` atau langkah instalasi npm. Browser memuat pustaka Supabase dan font dari internet.

## Struktur Proyek

```text
.
├── index.html              # Pendaftaran dan login
├── dashboard.html          # Workspace pengunjung, anggota, dan admin
├── supabase-schema.sql     # Skema database, RPC, RLS, trigger, bootstrap admin
├── E2E-TESTING.md          # Checklist pengujian manual end-to-end
├── css/
│   ├── dashboard.css       # Tampilan workspace dashboard
│   ├── form.css            # Tampilan form autentikasi
│   └── style.css           # Gaya dasar halaman autentikasi
└── js/
    ├── auth.js             # Login dan pendaftaran Supabase Auth
    ├── dashboard.js        # Navigasi, data dashboard, CRUD, role, dan realtime
    ├── form.js             # Perpindahan tab form autentikasi
    ├── supabaseClient.js   # Inisialisasi Supabase untuk dashboard
    └── transactions.js     # Skrip transaksi versi halaman lama
```

`dashboard.html` saat ini menggunakan `js/dashboard.js`. `js/transactions.js` masih berada di proyek sebagai implementasi transaksi sebelumnya dan tidak dimuat oleh dashboard tersebut.

## Persiapan Supabase

1. Buat project Supabase.
2. Buka **Project Settings → API** dan salin **Project URL** serta **anon/public key**.
3. Pastikan Project URL dan anon key yang dipakai aplikasi mengarah ke project yang sama. Konfigurasi frontend saat ini tertanam pada `index.html` dan `js/supabaseClient.js`; ubah kedua lokasi bila berpindah project.
4. Buka **SQL Editor** di Supabase, lalu jalankan seluruh isi `supabase-schema.sql`.
5. Pastikan URL lokal atau domain aplikasi sudah diizinkan pada pengaturan Auth URL/redirect Supabase. Jika verifikasi email aktif, pengguna perlu memverifikasi email sebelum login.
6. Pastikan Realtime aktif untuk tabel `buku`, `transactions`, dan `profiles`. Bagian akhir skema menambahkan tabel tersebut ke publikasi `supabase_realtime` bila publikasi tersedia.

Frontend hanya boleh memakai anon/public key. Jangan pernah menaruh `service_role` key di HTML, JavaScript browser, repository, atau dokumentasi publik. Keamanan akses data bergantung pada kebijakan RLS dalam skema.

> Catatan konfigurasi: `index.html` saat ini membuat client dari konfigurasi inline, sedangkan `js/supabaseClient.js` menginisialisasi client untuk dashboard bila belum tersedia. Samakan kedua konfigurasi saat mengganti project.

## Menjalankan Secara Lokal

Jalankan server HTTP dari direktori proyek. Contoh di Windows:

```powershell
py -m http.server 5500
```

Kemudian buka [http://localhost:5500/](http://localhost:5500/) di browser. Alternatifnya, gunakan ekstensi VS Code Live Server. Jangan membuka file HTML langsung dengan skema `file://`, karena autentikasi dan request browser ke Supabase sebaiknya diuji melalui server HTTP.

## Membuat Akun Admin Pertama

Pendaftaran dari halaman aplikasi selalu membuat profil ber-role `anggota`. Admin pertama perlu dipromosikan secara manual setelah akun terdaftar dan terlihat di Supabase Auth.

Di **SQL Editor**, jalankan perintah berikut setelah mengganti email dan nama admin:

```sql
insert into public.profiles (id, full_name, role)
select id, 'Nama Admin', 'admin'
from auth.users
where email = 'admin@example.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = 'admin',
    updated_at = now();
```

Pastikan query menemukan tepat satu akun. Jika belum ada baris pengguna dengan email tersebut, daftarkan akun terlebih dahulu. Jangan memberi role admin melalui form publik.

## Role dan Akses

| Kemampuan | Pengunjung | Anggota | Admin |
| --- | --- | --- | --- |
| Melihat katalog dan stok | Ya | Ya | Ya |
| Mengajukan peminjaman | Tidak | Ya | Ya |
| Melihat riwayat transaksi | Tidak | Transaksi sendiri | Semua transaksi |
| Mengelola judul dan stok buku | Tidak | Tidak | Ya |
| Mengubah status atau menghapus transaksi | Tidak | Tidak | Ya |
| Melihat dan mengubah role profil | Tidak | Tidak | Ya |

Dashboard membaca `profiles.role` untuk menampilkan fitur yang sesuai. RLS dan RPC Supabase juga memeriksa hak akses di database; menyembunyikan kontrol antarmuka saja bukan batas keamanan.

## Skema Data

- `public.buku`: katalog buku, stok, dan waktu pembuatan.
- `public.transactions`: transaksi peminjaman, peminjam (`borrower_id`), buku, jumlah, status, dan waktu transaksi.
- `public.profiles`: nama dan role pengguna (`anggota` atau `admin`), terhubung ke `auth.users`.

Status transaksi yang didukung:

- `sedang dipinjam`
- `sudah dikembalikan`
- `terkena denda`

Trigger `on_auth_user_created` membuat profil anggota otomatis ketika akun Supabase Auth baru dibuat. Fungsi RPC `proses_transaksi` memastikan peminjam sudah login, mengunci baris buku selama pengecekan stok, mengurangi stok, dan membuat transaksi dalam satu operasi database. Fungsi `set_transaction_status` hanya dapat dijalankan admin; pengembalian menambah stok dan status yang sudah final tidak diproses ulang.

Menghapus buku akan menghapus transaksi terkait karena foreign key menggunakan `on delete cascade`. Ini berarti riwayat transaksi untuk buku tersebut ikut terhapus.

## Pengujian

Gunakan [E2E-TESTING.md](E2E-TESTING.md) sebagai checklist manual. Uji minimal:

1. Daftar dan login sebagai anggota.
2. Ajukan peminjaman valid, lalu coba jumlah melebihi stok.
3. Pastikan anggota hanya melihat transaksinya sendiri dan tidak dapat mengubah katalog atau status transaksi.
4. Login sebagai admin dan uji pengelolaan buku, status transaksi, serta role anggota.
5. Muat ulang halaman dan periksa sinkronisasi Realtime.
6. Logout, lalu pastikan operasi terlindungi tetap ditolak oleh RLS.

Setiap pengujian yang mengubah data sebaiknya menggunakan project dan data uji, bukan catatan perpustakaan produksi.

## Pemecahan Masalah

- **`Supabase client tidak tersedia`**: periksa koneksi internet, pemuatan CDN Supabase, Project URL, dan anon key di kedua lokasi konfigurasi.
- **Profil belum tersedia atau role tidak tampil**: jalankan ulang `supabase-schema.sql`, pastikan akun ada di `auth.users`, dan periksa trigger `on_auth_user_created`.
- **Admin masih tampil sebagai anggota**: pastikan profil memiliki `role = 'admin'`, lalu refresh dashboard atau login ulang.
- **Gagal meminjam / RPC tidak ditemukan**: pastikan fungsi `proses_transaksi` sudah dibuat dari skema terbaru dan nama argumen RPC tidak berubah.
- **Peminjaman ditolak karena stok**: periksa stok buku di katalog. Validasi dilakukan ulang di database, jadi nilai stok pada antarmuka bukan satu-satunya pemeriksaan.
- **Tidak ada update realtime**: periksa status koneksi di bagian atas dashboard dan pastikan tabel terkait masuk ke publikasi Supabase Realtime.
- **RLS menolak operasi**: ini biasanya berarti role akun atau kebijakan database tidak mengizinkan aksi tersebut. Jangan memperbaikinya dengan menaruh service-role key di frontend atau menonaktifkan RLS.

## Catatan Pengembangan

- Tidak diperlukan proses bundling atau kompilasi; perubahan HTML, CSS, dan JavaScript statis langsung dimuat ulang oleh browser.
- Pertahankan validasi database dan kebijakan RLS meskipun validasi antarmuka juga tersedia.
- Untuk instruksi uji yang lebih rinci, lihat `E2E-TESTING.md`.
