# Audit lanjutan trial — 8–9 September 2026

**Keputusan: belum siap trial.** Perbaikan alur aplikasi sudah diuji, tetapi audit lanjutan membuktikan akses publik langsung ke database masih terbuka. Tidak ada commit atau push. Perubahan izin keamanan di bawah belum diterapkan.

## Prioritas 0: Data API dapat melewati login dan validasi aplikasi

Pemeriksaan metadata PostgreSQL pada 9 September 2026 menunjukkan delapan tabel berikut mempunyai RLS nonaktif dan role anon mempunyai izin SELECT, INSERT, UPDATE, DELETE:

User, Transaction, Order, OrderItem, OrderSubmission, LoginThrottle, MenuItem, Category.

Permintaan baca kosong ke Data API User, Transaction, dan OrderSubmission menggunakan anon key mendapat HTTP 200. Pemeriksaan menggunakan select=id&limit=0: tidak mengambil data akun, password, atau pelanggan. Tidak dilakukan percobaan menulis atau menghapus lewat akses anonim.

Gabungan izin tabel dan RLS nonaktif berarti perlindungan di API Next.js bisa dilewati melalui Data API. Orang yang mendapatkan anon key publik dapat berpotensi mengakses kredensial tersimpan, mengubah role, harga, tagihan atau data pesanan, serta menghapus hitungan login. Ini risiko utama sebelum restoran melayani pelanggan.

Aplikasi memakai Prisma pada src/lib/prisma.js dengan role koneksi postgres dan bypassrls=true (diverifikasi). Endpoint autentikasi dan pembayaran yang diperketat hanya melindungi jalur Next.js, bukan akses langsung Supabase.

Usulan konkret: aktifkan RLS dan cabut izin anon/authenticated pada delapan tabel aplikasi. Draft transaksi SQL tersedia di prisma/sql/trial-public-access-review.sql; **belum dijalankan**. Uji kembali seluruh API aplikasi, dan pastikan permintaan Data API anonim ditolak. Setiap tabel baru juga harus memiliki migrasi izin/RLS yang sesuai.

## Prioritas 1: unggahan Storage masih bisa melewati validasi server

Metadata pg_policies menunjukkan policy bernama "Izinkan upload foto menu": role public, operasi INSERT, kondisi bucket_id = 'menu-images'. Jadi izin upload berlaku untuk pemegang anon key, bukan hanya staf aplikasi.

src/app/api/upload/route.js juga memakai NEXT_PUBLIC_SUPABASE_ANON_KEY. Artinya validasi PNG, batas 5 MB, dan requireStaff pada route ini belum melindungi jalur upload langsung ke Storage.

SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi. Penutupan policy upload publik harus disertai perubahan route upload memakai kredensial server saja. Jika hanya policy dihapus, upload aplikasi yang sekarang juga akan gagal. Pembacaan gambar dari bucket publik dapat tetap dipertahankan; izin tulis harus ditutup. Tidak ada upload anonim atau perubahan policy saat audit.

## Perbaikan aplikasi yang sudah tersedia lokal

| Temuan sebelumnya | Hasil perbaikan |
| --- | --- |
| Pembayaran memakai tagihan lama | Pemeriksaan total + revisi di dalam penguncian sesi. Snapshot basi ditolak. Total yang dikonfirmasi, petugas, dan ID pembayaran disimpan; retry identik tidak mencatat pembayaran kedua. |
| Edit menggabungkan harga historis | Item lama dikenali berdasarkan ID asal. Harga, ID order, waktu, serta bungkus/makan di tempat dipertahankan. Tambahan memakai harga database. |
| Belum ada penerimaan kitchen nyata | Antrean Kitchen: menunggu → diterima → dimasak → siap → disajikan. Edit meminta konfirmasi ulang dan versi lama ditolak. Pembatalan tetap terlihat sampai dikonfirmasi. |
| Meja ganda saat permintaan bersamaan | Penguncian nomor meja yang sudah dinormalisasi pada pembuatan/pemindahan. |
| Koneksi gagal tidak terlihat | Penyegaran transaksi lintas tab; polling kitchen/pelanggan, indikator koneksi, serta batas tunggu. |
| Akun bawaan/password lemah | Form/seed tanpa password default, validasi server, password lama plaintext ditingkatkan menjadi hash setelah login, password bawaan wajib diganti sebelum operasional. |
| Login tanpa pembatasan | 10 percobaan per username/15 menit pada database; hitungan direset setelah login berhasil. Tetap memerlukan penutupan Data API di atas. |
| PNG palsu/terlalu besar melalui route | Multipart dibatasi, maksimal 5 MB/4096 × 4096, signature+decode diperiksa dan PNG diencode ulang. Tetap memerlukan penutupan upload Storage langsung. |

Batas order mandiri 10 porsi/menu, 30 porsi/kiriman, 100 porsi/sesi, 5 pengiriman baru/menit serta identitas retry dan penolakan sesi tertutup tetap dipertahankan.

## Fitur akun dan pemetaan operasional

Buka Kelola Karyawan → Tambah Akun → pilih Admin/Kasir. Hanya admin boleh mengelola akun. Form memiliki konfirmasi password, tampil/sembunyikan password, informasi tambahan opsional, penahan klik cepat, dan tampilan HP. Akun sendiri tidak dapat dihapus/diturunkan; admin terakhir dilindungi.

| Fitur | Status |
| --- | --- |
| Penerimaan kitchen | Sudah ada dalam perubahan lokal, diuji endpoint dan browser |
| Status order | Sudah ada status kitchen terpisah dari pembayaran/sesi |
| Modifier/catatan makanan | Belum ada kolom atau alur penyimpanan yang terverifikasi; bungkus/makan di tempat bukan modifier |
| Pemesanan lewat staf | Sebagian: takeaway langsung dan penambahan melalui Edit tersedia; bukan alur pelayan khusus |
| Printer kitchen otomatis | Belum terverifikasi; antrean layar menjadi jalur operasional saat printer gagal |

## Migrasi dan pemeriksaan

prisma/sql/trial-readiness.sql sudah diterapkan secara aditif dan Prisma Client diperbarui. Riwayat pesanan lama diberi status legacy: hanya sesi aktif diminta konfirmasi manual; riwayat selesai tidak dimasukkan ke antrean. Data pesanan restoran tidak dihapus atau digabung. Draft penutupan akses publik adalah file terpisah dan belum diterapkan.

- node --test tests/*.test.cjs: 83 tes lulus.
- node tests/trial-postgres.cjs: 11 pemeriksaan PostgreSQL lulus; data bisnis uji di-rollback.
- node tests/trial-table-concurrency.cjs: 6 permintaan bersamaan → 1 sesi, 5 konflik. Meja uji dibersihkan.
- node tests/trial-browser.cjs: formulir desktop/HP, submit cepat, edit harga historis, konflik pembayaran, penerimaan kitchen, koneksi putus, dan status pelanggan lulus tanpa runtime error. API browser menggunakan fixture; perlu Playwright dan Edge.
- Lint kode baru dan build produksi akhir lulus.

## Sebelum trial

1. Tutup akses Data API dan tulis Storage di atas; ulangi pengujian setelah perubahan izin.
2. Refresh seluruh layar setelah pembaruan. Klien lama tanpa revisi edit/pembayaran ditolak dengan aman.
3. Uji restoran menggunakan dua perangkat: pesan → kitchen menerima → bayar → tutup sesi → gunakan kembali nomor meja. Halaman sesi lama wajib ditolak.
4. Uji putus koneksi dan printer fisik, serta latihan pemulihan backup. Bukti backup/restore dan HTTPS produksi belum diperoleh.
5. Sesi ganda yang sudah ada sebelum perbaikan jangan digabung otomatis; cocokkan tagihan masing-masing dengan staf.

Untuk seed instalasi pertama, konfigurasi INITIAL_ADMIN_USERNAME dan INITIAL_ADMIN_PASSWORD. Seed tidak mengganti admin yang sudah ada.
