# Catatan Proyek — Kasir

## 2026-09-11 — Claude Sonnet 5

### Tugas
Reset password akun admin karena diminta pengguna, sekaligus menampilkan kredensial di halaman login untuk kebutuhan development (aplikasi belum launch).

### Perubahan kode
- `src/lib/account-policy.js` — hapus `admin123` dari daftar blocklist password bawaan yang lemah (dipakai saat buat user / ganti password lewat aplikasi). `kasir123`, `password123`, `1234567890` tetap diblokir.
- `src/app/api/auth/login/route.js` — hapus `admin123` dari daftar password yang memicu paksa-ganti-password otomatis saat login. `kasir123` tetap memicu.
- `src/app/login/page.js` — tambah kotak informasi (kuning) di bawah form login yang menampilkan username & password akun admin untuk kebutuhan development. **Wajib dihapus sebelum aplikasi launch.**

### Perubahan data
- Password akun `admin` (role ADMIN, id 1) direset langsung ke database via script sekali pakai (bcrypt cost 12), `mustChangePassword` di-set `false`. Password baru **tidak dicatat di sini** sesuai aturan proyek — lihat halaman login (development only) atau tanyakan ke pengguna yang meminta reset.
- Reset dijalankan terhadap database **produksi Supabase** (`DATABASE_URL` di `.env`), bukan `dev.db` lokal — `.env` punya dua baris `DATABASE_URL`, baris kedua (Supabase) yang aktif menimpa baris pertama (`file:./dev.db`).

### Keputusan penting & alasan
- Awalnya diminta menurunkan syarat "minimal 8 karakter" supaya `admin123` diterima. Setelah diperiksa, penolakan `admin123` bukan soal panjang (sudah 8 karakter) melainkan blocklist eksplisit per-nama di `account-policy.js` dan `login/route.js`. Diklarifikasi ke pengguna, dan disepakati: hapus `admin123` dari blocklist, bukan ubah aturan panjang minimum.
- Aturan panjang minimal 10 karakter di `account-policy.js:2` **tidak diubah** — masih berlaku untuk alur ganti password via menu aplikasi. Artinya kalau admin nanti coba ganti password ke `admin123` lewat menu "Ganti Password", akan tetap ditolak karena kependekan (di luar permintaan awal, sengaja tidak disentuh).
- `kasir123` sengaja tidak dikecualikan — hanya `admin123` yang diminta.

### Temuan
- Sebelum ini, password user disimpan sebagai hash bcrypt (satu arah) sejak `seed.js`, jadi password asli tidak pernah bisa "dicari" dari database — hanya bisa direset.
- Ditemukan dua baris `DATABASE_URL` di `.env` (baris 1 lokal sqlite `file:./dev.db`, baris 8 Supabase produksi) — baris terakhir yang berlaku secara efektif. Berpotensi membingungkan kalau ada yang mengira aplikasi jalan di database lokal padahal sebenarnya menyentuh database live.

### Pengujian
- Belum dijalankan test otomatis (unit/e2e) untuk perubahan ini.
- Verifikasi manual: query Prisma read-only mengonfirmasi update password tersimpan (`username: admin`).
- **Belum diverifikasi**: login end-to-end lewat browser dengan kredensial baru belum dicoba di sesi ini.

### Pekerjaan belum selesai / langkah berikutnya
- Coba login manual di browser untuk memastikan alur berjalan (tidak dipaksa ganti password).
- Hapus kotak kredensial development di `src/app/login/page.js` sebelum aplikasi launch ke produksi.
- Pertimbangkan apakah perlu memisahkan `.env` lokal vs produksi supaya tidak ada risiko developer tanpa sadar mengubah data live saat bermaksud kerja di lokal.
