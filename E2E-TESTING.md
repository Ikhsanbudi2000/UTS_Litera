# Checklist Pengujian End-to-End Litera

Checklist ini digunakan untuk menguji aplikasi melalui antarmuka browser dan Supabase. Catat hasil aktual pada kolom status.

## Prasyarat

- Jalankan `index.html` melalui server lokal atau Live Server.
- Pastikan URL dan anon key pada `js/supabaseClient.js` mengarah ke project Supabase yang benar.
- Jalankan `supabase-schema.sql` pada project tersebut.
- Siapkan akun uji dan pastikan tabel `buku` memiliki stok yang cukup.
- Gunakan data uji, bukan transaksi perpustakaan yang sebenarnya.

## Pengguna biasa

| No. | Langkah | Hasil yang diharapkan | Status |
| --- | --- | --- | --- |
| 1 | Buka `index.html`, pilih tab Daftar, lalu daftarkan email dan kata sandi valid. | Pendaftaran berhasil dan form kembali ke tab Login. | Belum diuji |
| 2 | Masuk menggunakan akun yang baru dibuat. | Login berhasil dan pengguna diarahkan ke `dashboard.html`. | Belum diuji |
| 3 | Isi transaksi dengan buku yang tersedia, jumlah positif yang tidak melebihi stok, dan nama peminjam. | Transaksi tersimpan, notifikasi sukses muncul, dan riwayat diperbarui. | Belum diuji |
| 4 | Kirim transaksi dengan jumlah kosong/tidak valid atau stok melebihi persediaan. | Transaksi ditolak, pesan error tampil, dan stok tidak berubah. | Belum diuji |
| 5 | Pilih Lihat Detail pada salah satu transaksi. | Detail transaksi yang dipilih tampil. | Belum diuji |
| 6 | Ubah status transaksi menjadi dikembalikan atau terkena denda. | Status tersimpan dan tampil pada riwayat. | Belum diuji |
| 7 | Muat ulang dashboard setelah transaksi berhasil. | Riwayat transaksi tetap tampil dari Supabase. | Belum diuji |
| 8 | Tekan Logout, lalu coba buka `dashboard.html` lagi. | Pengguna kembali ke halaman Login dan dashboard mengarahkan pengguna tanpa sesi ke Login. | Belum diuji |

## Admin

| No. | Langkah | Hasil yang diharapkan | Status |
| --- | --- | --- | --- |
| 1 | Masuk menggunakan akun admin. | Belum dapat diuji: aplikasi belum memiliki autentikasi/peran admin atau halaman khusus admin. | Terblokir: fitur belum tersedia |
| 2 | Coba akses pengelolaan pengguna atau koleksi sebagai admin. | Belum dapat diuji: antarmuka pengelolaan admin belum tersedia. | Terblokir: fitur belum tersedia |
| 3 | Pastikan pengguna biasa tidak dapat mengubah status transaksi sebagai admin. | Belum dapat diuji: pembatasan otorisasi berbasis peran belum diterapkan. | Terblokir: fitur belum tersedia |

## Catatan risiko yang perlu diperiksa

- `js/transactions.js` mencoba insert langsung ke tabel `transactions` jika pemanggilan RPC gagal. Karena itu, skenario stok tidak cukup harus memastikan tidak ada transaksi yang tersimpan dan stok tidak berubah. Jika transaksi tetap tersimpan, skenario dinyatakan gagal.
- `supabase-schema.sql` memberikan izin `insert` dan `update` kepada role `anon` dan `authenticated`. Jangan menganggap tombol atau penyembunyian UI sebagai pembatasan akses; kebijakan otorisasi admin perlu dibuat di database sebelum aplikasi digunakan dengan data nyata.

## Ringkasan hasil

- Tanggal pengujian:
- Project Supabase:
- Browser:
- Penguji:
- Jumlah skenario lulus:
- Jumlah skenario gagal:
- Catatan: