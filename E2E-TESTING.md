# Checklist Pengujian End-to-End Litera

Checklist ini digunakan untuk menguji aplikasi melalui antarmuka browser dan Supabase. Catat hasil aktual pada kolom status.

## Prasyarat

- Jalankan `index.html` melalui server lokal atau Live Server.
- Pastikan URL dan anon key pada `js/supabaseClient.js` mengarah ke project Supabase yang benar.
- Jalankan `supabase-schema.sql` pada project tersebut.
- Jalankan `supabase-schema.sql` pada project yang benar.
- Siapkan satu akun anggota dan satu akun admin; gunakan bootstrap SQL di bagian akhir schema untuk admin pertama.
- Pastikan tabel `buku` memiliki stok yang cukup.
- Gunakan data uji, bukan transaksi perpustakaan yang sebenarnya.

## Pengguna biasa

| No. | Langkah | Hasil yang diharapkan | Status |
| --- | --- | --- | --- |
| 1 | Buka `index.html`, pilih tab Daftar, lalu daftarkan nama, email, dan kata sandi valid. | Pendaftaran berhasil; trigger membuat profil ber-role `anggota`, dan email verifikasi diminta bila diaktifkan. | Belum diuji |
| 2 | Masuk menggunakan akun yang baru dibuat. | Login berhasil dan pengguna diarahkan ke `dashboard.html`. | Belum diuji |
| 3 | Ajukan peminjaman buku dengan jumlah positif yang tidak melebihi stok. | RPC memvalidasi stok secara atomik, transaksi dimiliki peminjam yang login, dan stok/riwayat diperbarui. | Belum diuji |
| 4 | Kirim transaksi dengan jumlah kosong/tidak valid atau stok melebihi persediaan. | Transaksi ditolak, pesan error tampil, dan stok tidak berubah. | Belum diuji |
| 5 | Pilih Lihat Detail pada salah satu transaksi. | Detail transaksi yang dipilih tampil. | Belum diuji |
| 6 | Coba mengubah status transaksi sebagai anggota. | Perubahan ditolak oleh RLS; kontrol admin tidak ditampilkan. | Belum diuji |
| 7 | Muat ulang dashboard setelah transaksi berhasil. | Riwayat transaksi tetap tampil dari Supabase. | Belum diuji |
| 8 | Tekan Logout, lalu coba buka `dashboard.html` lagi. | Pengguna kembali ke halaman Login dan dashboard mengarahkan pengguna tanpa sesi ke Login. | Belum diuji |

## Admin

| No. | Langkah | Hasil yang diharapkan | Status |
| --- | --- | --- | --- |
| 1 | Masuk menggunakan akun admin yang dipromosikan melalui SQL bootstrap. | Metrik, kontrol pengelolaan koleksi, status transaksi, dan panel anggota tampil. | Belum diuji |
| 2 | Tambah, ubah judul, tambah/kurangi stok, dan hapus buku. | Mutasi tersimpan; buku yang dihapus juga menghapus transaksi terkait melalui FK cascade. | Belum diuji |
| 3 | Ubah status transaksi, hapus log, lalu promosikan/demokan akun lain. | Pengembalian menambah stok tepat sekali; denda tidak menambah stok; perubahan broadcast Realtime. | Belum diuji |
| 4 | Panggil endpoint insert/update buku sebagai anggota. | RLS menolak mutasi, walaupun kontrol frontend dimanipulasi. | Belum diuji |

## Catatan risiko yang perlu diperiksa

- Transaksi anggota hanya dapat dibuat melalui RPC `proses_transaksi`; jangan menambahkan fallback insert langsung karena dapat melewati validasi stok.
- `anon` hanya membaca katalog buku. Perubahan buku, status transaksi, dan role profil dibatasi RLS ke admin.
- Bootstrap admin hanya dijalankan di SQL Editor untuk email yang telah ada di `auth.users`; jangan pernah memasukkan service-role key ke browser.

## Ringkasan hasil

- Tanggal pengujian:
- Project Supabase:
- Browser:
- Penguji:
- Jumlah skenario lulus:
- Jumlah skenario gagal:
- Catatan: