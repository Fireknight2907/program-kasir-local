# Perbaikan temuan PDF — 10 September 2026

## Hasil dan batas verifikasi

- F01: RLS aktif di delapan tabel aplikasi; izin anon/authenticated dicabut. Prisma server tetap memakai role postgres dengan bypass RLS. Admin/kasir dibedakan di API lewat sesi terverifikasi. Delapan permintaan Data API anonim dengan limit=0 mendapat HTTP 401. RLS tidak membedakan cookie aplikasi secara langsung; tidak ada izin tulis publik atau Supabase Auth yang dianggap sebagai sesi staf.
- F02: endpoint upload hanya admin; kredensial anon diganti service role server saja. Policy Storage `Izinkan upload foto menu` sudah dihapus. Batas tetap PNG 5 MiB, decode/re-encode dan dimensi maksimum 4096x4096. **Belum selesai: SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi; upload admin mengembalikan 503. Setelah tersedia, uji upload admin, penolakan kasir/anon, serta baca foto publik.**
- F03: POST/PUT menu menolak harga negatif, pecahan, string parsial, null, dan overflow; nol diterima. Edit order menolak menu tambahan dengan harga database negatif. Constraint MenuItem_price_nonnegative sudah diterapkan setelah hitungan harga negatif terbukti nol; data lama tidak diubah.
- F05: kebijakan eksplisit pengguna dipertahankan: rekap memakai tanggal createdAt (pembukaan sesi), UTC+8. Pembayaran lewat tengah malam tetap masuk tanggal sebelumnya. Tes memeriksa batas hari; perilaku ini bukan lagi bug menurut kebutuhan pengguna.
- F06: rekap mengelompokkan berdasarkan menuItemId dan harga historis, bukan nama. Statistik berdasarkan ID dengan harga rata-rata tertimbang; menu berbeda bernama sama tidak digabung. Kunci baris edit memakai rowKey; takeaway memakai menuItem.id. Tidak mengganti ID atau data pesanan historis.
- F08: admin-only menu/kategori/foto dan statistik/arsip di API dan tampilan. Kasir tetap transaksi hari ini, semua sesi aktif, kitchen, pembayaran, edit pesanan; tanggal query tidak memberi akses arsip. Detail transaksi historis juga menolak kasir. GET kategori kini baca saja.
- F09: respons QR anonim memakai daftar kolom eksplisit tanpa paidById, paymentRequestId, paymentMethod, acceptedById, kitchenVersion atau metadata menu yang tidak diperlukan. Respons staf yang berhak tetap lengkap.

## Verifikasi

- `node --test tests/*.test.cjs`: 97 lulus, termasuk 14 tes kebutuhan PDF.
- `node tests/trial-postgres.cjs`: 11 pemeriksaan PostgreSQL lulus setelah aktivasi RLS; data bisnis uji di-rollback.
- `node node_modules/next/dist/bin/next build`: lulus setelah perubahan terakhir.
- Review independen menemukan akses detail arsip dan kunci baris React; keduanya diperbaiki.
- Belum ada verifikasi unggah berhasil setelah penutupan Storage karena kredensial belum tersedia. Goal tetap aktif.
- Tidak ada commit, push, atau deploy Sites. Repo tetap Next.js/Prisma/Supabase; tidak diinisialisasi ulang atau dipindah ke runtime lain.

## Migrasi yang benar-benar diterapkan

- prisma/sql/trial-public-access-review.sql (RLS dan pencabutan grant)
- prisma/sql/menu-price-check.sql
- prisma/sql/menu-storage-private-write.sql

Dokumen ini memperbarui status izin yang sebelumnya disebut belum diterapkan dalam trial-readiness.md. Jangan menjalankan ulang ADD CONSTRAINT tanpa mengecek keberadaannya.

## Verifikasi ulang — 11 September 2026

Tidak ada perubahan ulang pada implementasi yang sudah memenuhi goal.

- 14 tes khusus kebutuhan PDF lulus.
- tests/pdf-postgres.cjs selesai: transaksi buka 23:55 dan selesai 00:10 hanya masuk hari pembukaan, fixture di-rollback dan ketiadaannya diperiksa.
- 8 tabel RLS aktif; 64 kombinasi anon/authenticated × tabel × SELECT/INSERT/UPDATE/DELETE ditolak melalui metadata privilege database.
- Fungsi calculateTableStats diuji dengan dua ID makanan bernama sama: tetap dua item. Dua porsi 10000 + satu porsi 16000 menghasilkan total 36000 dan harga rata-rata 12000.
- F02 tetap tertahan: SUPABASE_SERVICE_ROLE_KEY tidak tersedia saat pengecekan. Endpoint upload menolak aman dengan 503. Perlu konfigurasi kredensial server lalu uji unggahan admin dan pembacaan foto untuk menyatakan goal lengkap.
- Operasional kasir tetap mencakup meja, pesanan, kitchen, dan pembayaran; admin menangani menu/foto dan laporan. Untuk restoran yang kasirnya juga pemilik, gunakan akun admin terpisah saat mengelola menu.
