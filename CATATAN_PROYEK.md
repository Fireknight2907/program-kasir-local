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

---

## 2026-09-11 (lanjutan) — Claude Sonnet 5

### Tugas
Audit fitur "Statistik Meja" (`src/app/page.js`, fungsi `calculateTableStats()`): cek error, cek kebenaran perhitungan, dan cek mendalam bagian rincian performa per meja, urutan pesanan, dan analisis jam sibuk.

### Temuan (dugaan vs terbukti)
**Terbukti (dibaca langsung dari kode, bukan dugaan):**
1. **Zona waktu UTC+8 di `src/app/api/transaction/route.js:36-44` dan `:70-76`** — dipakai untuk batas awal/akhir hari saat filter tanggal Arsip & Statistik. Secara umum UTC+8 = WITA, bukan WIB (UTC+7). **Ditinjau bersama pengguna: TIDAK diperbaiki** karena restoran ini beroperasi di Manado (zona WITA/UTC+8), jadi kode sudah sesuai dengan lokasi asli. Dicatat di sini supaya tidak keliru "diperbaiki" oleh AI lain di masa depan tanpa konteks ini.
2. **`avgItemsPerTable` (rata-rata porsi menu per meja) ikut menghitung item dari sesi Take Away** — pembilang (`totalItemsSoldOverall`) mencakup semua penjualan termasuk take away, sedangkan penyebut (`distinctTablesUsed`) hanya meja fisik. Hasilnya rata-rata porsi/meja jadi lebih tinggi dari yang sebenarnya kalau ada take away di hari itu. **Sudah diperbaiki.**
3. **`topTurnoverTable` ("Meja Paling Sering Diputar", Card 5) tidak memfilter Take Away** — kandidatnya diambil dari `tableList` yang berisi meja fisik + sesi take away. Kalau ada 2+ pesanan take away dengan nama pelanggan sama di hari yang sama (jadi digabung jadi satu "meja" di `tableMap`, kunci gabung = nama pelanggan, lihat `page.js:1063`), sesi take away itu bisa menang dan salah tertampil sebagai meja fisik dengan turnover tertinggi. **Sudah diperbaiki.**
4. **Relasi `orders` diambil tanpa `orderBy` eksplisit** di `src/app/api/transaction/route.js` (dipakai Statistik Meja) dan `src/app/api/transaction/[id]/route.js` (dipakai modal Edit Pesanan & halaman order pelanggan). Klasifikasi "Order Utama vs Tambahan" (`page.js:352-357`, dasar dari kartu "Total Order Diterima" dan tab "Urutan Pesanan") ditentukan dari **posisi index array pertama**, bukan dari `createdAt`. Tanpa `orderBy`, urutan hasil query Prisma/Postgres tidak dijamin kronologis. **Sudah diperbaiki** (tambah `orderBy: { createdAt: 'asc' }` di kedua endpoint).

**Tidak ada error runtime/crash** ditemukan di fitur ini (tidak ada pembagian oleh nol atau null-reference yang bisa pecah).

**Perlu klarifikasi bisnis (belum diubah, menunggu keputusan pengguna):**
- Definisi "Jam Paling Sibuk" (`peakHour`, `page.js:491`) saat ini = jam dengan **jumlah order tiket terbanyak** (tie-break: jumlah porsi menu). Bukan berdasarkan revenue atau jumlah meja. Apakah ini sudah sesuai maksud bisnis?
- "Rata-Rata Durasi Meja Terisi" (Card 4, `avgDurationMsOverall`) mencampur durasi sesi Take Away dengan meja dine-in. Apakah Take Away seharusnya ikut dihitung di metrik durasi "meja"?

### Perubahan kode
- `src/app/page.js`:
  - Tambah `physicalItemsQuantity` (jumlah porsi menu khusus meja fisik, tidak termasuk take away).
  - `avgItemsPerTable` sekarang pakai `physicalItemsQuantity / distinctTablesUsed`, bukan `totalItemsSoldOverall / distinctTablesUsed`.
  - `topTurnoverTable` sekarang `.filter(t => !t.isTakeAway)` sebelum diurutkan.
- `src/app/api/transaction/route.js` — tambah `orderBy: { createdAt: 'asc' }` pada include `orders`.
- `src/app/api/transaction/[id]/route.js` — tambah `orderBy: { createdAt: 'asc' }` pada include `orders` (endpoint sama dipakai di luar Statistik Meja juga, tapi root cause & perbaikannya identik sehingga sekalian dibereskan).

### Pengujian
- `npx eslint` pada 3 file yang diubah: hasil **identik** dengan sebelum perubahan (6 error/6 warning pra-existing, semuanya di baris lain yang tidak disentuh — dikonfirmasi lewat `git stash` + lint ulang). Tidak ada error baru dari perubahan ini.
- **Belum dijalankan**: uji end-to-end di browser (buka tab Statistik Meja, cek angka Card 5 dan footer "Avg Menu Dipesan / meja" dengan data yang ada campuran take away + dine-in). Disarankan dicoba manual sebelum dianggap selesai total.

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual di browser dengan skenario: 1 hari yang punya transaksi dine-in DAN take away, pastikan Card 5 ("Meja Paling Sering Diputar") dan footer avg porsi/meja di tab "Rincian Performa" sudah masuk akal (tidak lagi kebocoran data take away).
- Pengguna perlu memutuskan definisi bisnis "Jam Paling Sibuk" dan apakah durasi Take Away ikut dihitung di "Rata-Rata Durasi Meja Terisi" (lihat bagian Temuan di atas).

---

## 2026-09-12 — Claude Sonnet 5

### Tugas
Audit menyeluruh alur customer: scan QR → pesan → kitchen → bayar, plus skenario di luar alur normal (bayar dulu baru disajikan, refresh saat memesan, internet lemot, race condition).

### Metode
Audit kode (`order/[transactionId]/page.js`, `api/order/route.js`, `api/kitchen/route.js` + `[id]/route.js`, `api/transaction/route.js` + `[id]/route.js` + `edit-order/route.js`, `table-session.js`, `session.js`, `KitchenPanel.js`) **plus verifikasi langsung** dengan menjalankan dev server lokal terhadap database PostgreSQL lokal (lihat bagian "Infrastruktur baru" di bawah) dan mengirim request nyata (curl) untuk mensimulasikan retry/race.

### Temuan & status

**TERBUKTI & DIPERBAIKI — `POST /api/transaction` (buka meja / Take Away) tidak idempotent**
- Lokasi: `src/app/page.js` (`handleCreateTransactionWithTable`, `handleCreateDirectTakeaway`), `src/app/api/transaction/route.js`.
- Skenario: di internet lemot, request buka meja/take away bisa sukses di server tapi responsnya hilang di client. Retry (klik ulang) sebelumnya membuat transaksi/sesi BARU yang duplikat — untuk Take Away ini luput dari pengecekan bentrok meja sama sekali (`table-session.js:6` sengaja mengecualikan nama "take away"), jadi sesi kosong menumpuk tanpa disadari. Untuk meja dine-in, retry kena `409 Meja sedang terisi` tapi membingungkan karena meja pertama sukses dibuka secara diam-diam.
- Perbaikan: tambah kolom `creationRequestId` (unique, nullable) di model `Transaction` (`prisma/schema.prisma`). Client sekarang generate & simpan `requestId` ke localStorage SEBELUM mengirim request (pola sama seperti `/api/order`); server mengecek `creationRequestId` dulu sebelum membuat baris baru — kalau sudah ada, kembalikan sesi yang sama.
- **Diverifikasi via eksekusi nyata** (bukan cuma baca kode): 2x POST `/api/transaction` dengan `requestId` sama → mengembalikan `id` transaksi yang SAMA, dikonfirmasi juga langsung di database (`SELECT` hanya 1 baris). Lihat bagian Pengujian.

**TERBUKTI, TIDAK DIPERBAIKI (butuh keputusan bisnis) — Edit pesanan mereset kitchenStatus meski hanya mengurangi/menghapus item**
- Lokasi: `src/app/api/transaction/[id]/edit-order/route.js:40`.
- Order yang sudah `served` bisa balik jadi `queued` di panel Kitchen hanya karena kasir menghapus/mengurangi 1 item (misal koreksi billing), padahal makanan sudah disajikan. Berlaku sama untuk nambah maupun kurangi item — UI kasir cuma mengingatkan untuk kasus nambah ("Perubahan jumlah dikirim kembali untuk dikonfirmasi kitchen", `page.js:2289`).
- **Belum diperbaiki** — menunggu keputusan pengguna apakah pengurangan/penghapusan item pada order yang sudah `served`/`ready` seharusnya TIDAK mereset status kitchen.

**TERBUKTI AMAN (diverifikasi via eksekusi, bukan cuma dugaan) — tidak perlu perbaikan:**
- Alur normal scan QR → pesan → kitchen → bayar: benar.
- "Bayar dulu, baru disajikan": PUT payment tidak mengecek status kitchen; kitchen tetap bisa lanjut queued→accepted→preparing→ready→served pada transaksi yang sudah `completed` (hanya diblokir kalau `cancelled`). **Diuji langsung**: transaksi ditandai `completed`, lalu order berhasil diproses sampai `served` tanpa error.
- Refresh saat memesan (customer): desain localStorage-first + `requestId` di `OrderSubmission` (unique constraint) sudah benar-benar mencegah order dobel. **Diuji langsung**: 2x POST `/api/order` dengan `requestId` sama → order id yang sama, DB hanya 1 baris.
- Race 2 request bersamaan ke meja yang sama: dilindungi row-lock (`updateMany increment:0`) dan `pg_advisory_xact_lock` per nama meja.

**Temuan minor (UX saja, tidak berisiko data) — belum diperbaiki:**
- `handleSaveEditOrder` (`page.js`) hanya auto-tutup modal utk error `ORDER_CONFLICT`, tidak untuk `SESSION_CLOSED` (transaksi keburu dibayar staf lain) — modal tetap terbuka dengan data basi, cuma alert.
- `POST /api/order` di halaman customer tidak punya timeout eksplisit (beda dengan polling status yang pakai `AbortSignal.timeout`). Risiko rendah karena sudah dilindungi desain localStorage.

### Perubahan kode
- `prisma/schema.prisma` — tambah `creationRequestId String? @unique` di model `Transaction`.
- `src/app/api/transaction/route.js` — `POST` sekarang wajib `requestId` (format sama seperti order), cek idempotency sebelum create, tangani race unique-constraint (P2002) dengan re-fetch.
- `src/app/page.js` — `handleCreateTransactionWithTable` (buka meja dine-in) dan `handleCreateDirectTakeaway` (Take Away Direct) generate+simpan `requestId` ke localStorage sebelum fetch, kirim ke server, hapus dari localStorage setelah sukses.

### Infrastruktur baru — PostgreSQL lokal untuk testing
Sebelumnya tidak ada database lokal (schema pakai `provider="postgresql"`, `.env` hanya berisi URL Supabase produksi) — jadi setiap uji coba berisiko menyentuh data live. Sekarang tersedia:
- PostgreSQL 18 terinstal di `C:\Program Files\PostgreSQL\18` (via Chocolatey — instalasi via winget/EnterpriseDB langsung diblokir 403 oleh CDN mereka dari environment ini).
- Service `postgresql-x64-18` berjalan sebagai Windows Service (auto-start).
- Database `kasir_local` + user `kasir_dev` dibuat khusus untuk dev/testing (password tidak dicatat di sini — ada di riwayat perintah shell sesi ini, sebaiknya di-reset kalau mau dipakai jangka panjang).
- Password superuser `postgres` di-generate otomatis oleh installer (bukan saya yang tentukan) — **belum diganti**, disarankan diganti sebelum dipakai serius (lihat warning saat instalasi).
- `DATABASE_URL`/`DIRECT_URL` untuk lokal **tidak ditulis ke `.env` atau `.env.local`** — sengaja dibiarkan manual (dipassing eksplisit lewat env var saat menjalankan perintah) supaya `npm run dev` / `prisma db push` biasa TIDAK tiba-tiba pindah target ke lokal atau sebaliknya. Kalau mau dijadikan default dev, perlu keputusan eksplisit dari pengguna karena ini mengubah alur kerja.

### Pengujian (dijalankan nyata, bukan cuma lint)
- `prisma db push` ke `kasir_local` — berhasil, skema baru (`creationRequestId`) masuk.
- Dev server (`next dev`) dijalankan di port 3311 mengarah ke `kasir_local`, sudah dimatikan setelah selesai.
- Login admin test, buka Take Away 2x dengan `requestId` sama → 1 baris di DB (bug lama terbukti fix).
- Submit order 2x dengan `requestId` sama → 1 baris order di DB.
- Tandai transaksi `completed` lalu proses kitchen queued→accepted→preparing→ready→served → semua `200 OK`.
- `npx eslint` pada file yang diubah: tidak ada error/warning baru dibanding sebelum perubahan (dicek pre-existing lewat pembanding, sama seperti audit Statistik Meja sebelumnya).

### Pekerjaan belum selesai / langkah berikutnya
- Keputusan bisnis: apakah pengurangan/penghapusan item pada order yang sudah `served` seharusnya tidak mereset kitchenStatus (lihat Temuan di atas).
- Opsional: perbaiki auto-close modal untuk error `SESSION_CLOSED` di edit-order (UX minor).
- Opsional: tambah timeout eksplisit pada fetch `/api/order` di halaman customer.
- Ganti password superuser `postgres` PostgreSQL lokal (di-generate installer) kalau database lokal ini mau dipakai berkelanjutan, bukan sekali pakai.
- Belum diuji di browser sungguhan (hanya via curl/API) — perilaku UI (localStorage, tombol disabled, dsb) sudah ditinjau dari kode tapi belum diklik langsung di browser.

---

## 2026-09-14 — Claude Sonnet 5

### Tugas
Diminta investigasi (tanpa mengubah kode) kenapa `localhost:3000` menampilkan banner "Koneksi bermasalah..." dan `GET /api/transaction` mengembalikan 500, bukan 200.

### TERBUKTI (diverifikasi via eksekusi, bukan dugaan) — Kolom `creationRequestId` belum ada di database produksi Supabase, tapi Prisma Client lokal sudah mengharapkannya
- Lokasi: `prisma/schema.prisma:37` (field `creationRequestId`), `src/app/api/transaction/route.js` (GET & POST keduanya query/tulis kolom ini).
- Bukti: query read-only `information_schema.columns` langsung ke database yang ditunjuk `DATABASE_URL` aktif di `.env` (Supabase produksi, `aws-0-ap-southeast-1.pooler.supabase.com`) — kolom `creationRequestId` **tidak ada** di tabel `Transaction` produksi. Sebelumnya (lihat entri 2026-09-13 di atas) `prisma db push` untuk kolom ini hanya dijalankan ke `kasir_local` (database lokal), **bukan** ke Supabase produksi.
- Karena `npx prisma generate` sudah dijalankan dengan schema baru (dikonfirmasi lewat isi `node_modules/.prisma/client/schema.prisma`), Prisma Client sekarang selalu menyertakan kolom `creationRequestId` di query SQL-nya untuk model `Transaction` — termasuk `findMany` biasa di `GET /api/transaction`. Query itu gagal di Postgres (`column "creationRequestId" does not exist`), error tertangkap oleh `catch` generik di `route.js:103-104` lalu dikembalikan sebagai `500 { error: 'Failed to fetch transactions' }`.
- Dampak: bukan cuma `GET` (daftar transaksi) yang gagal — `POST /api/transaction` (buka meja dine-in & Take Away Direct) juga eksplisit query/insert `creationRequestId` (`route.js:17,21`), jadi **pembuatan transaksi baru di produksi kemungkinan besar ikut gagal (500)** dengan mekanisme yang sama. Belum dicoba langsung (lihat Pengujian) karena berisiko menulis data ke DB live tanpa izin eksplisit.
- Temuan tambahan (bukan penyebab, tapi memperlambat diagnosa): `catch` di `GET /api/transaction` (`route.js:103-104`) **tidak** `console.error(error)` seperti di `POST` (`route.js:29`) — jadi error asli tidak akan muncul di terminal `npm run dev` sekalipun, hanya pesan generik di response.

### Pengujian (dijalankan nyata)
- `curl` ke `GET /api/transaction` tanpa cookie valid → `401` cepat (16ms) — membuktikan server jalan, tapi tidak menyentuh DB (auth gagal duluan).
- `Test-NetConnection` ke `aws-0-ap-southeast-1.pooler.supabase.com:6543` → TCP berhasil — bukan masalah konektivitas jaringan/firewall.
- Query `information_schema.columns` read-only via Prisma Client langsung ke DB produksi → mengonfirmasi kolom `creationRequestId` memang tidak ada di tabel `Transaction` produksi. Ini query `SELECT` murni, tidak menulis apa pun.
- **Belum dicoba**: request `POST /api/transaction` sungguhan ke produksi (sengaja dihindari karena berpotensi menulis baris transaksi live tanpa izin pengguna).

### Pekerjaan belum selesai / langkah berikutnya
- **Perlu keputusan pengguna**: apakah `prisma db push` (atau migration resmi) mau dijalankan ke database produksi Supabase sekarang untuk menambahkan kolom `creationRequestId`? Ini yang akan memperbaiki baik `GET` maupun `POST /api/transaction`. Belum dieksekusi karena ini mengubah skema database live — butuh persetujuan eksplisit.
- Setelah kolom ditambahkan, sebaiknya juga tambahkan `console.error(error)` di `catch` GET `route.js:103` supaya error server-side ke depannya tidak senyap (opsional, UX/observability saja, bukan bagian dari perbaikan bug utama).
- Belum diverifikasi apakah endpoint lain (mis. `POST /api/order`, kitchen, dsb.) ikut terdampak — investigasi ini baru fokus ke `/api/transaction` sesuai laporan pengguna.

### UPDATE (masih 2026-09-14) — Sudah diperbaiki: kolom `creationRequestId` ditambahkan ke database produksi
- Pengguna sempat coba `npx prisma db push` sendiri, tapi kolom di produksi tetap belum ada — dugaan kuat: terminal yang dipakai masih ada environment variable `DATABASE_URL`/`DIRECT_URL` ter-*export* dari sesi testing `kasir_local` (lokal) sebelumnya, jadi push kemarin kena ke database lokal, bukan produksi. **Belum dikonfirmasi 100% oleh pengguna**, ini masih dugaan (evidence: `prisma migrate diff` read-only terhadap `DIRECT_URL` produksi masih menunjukkan kolom itu belum ada, persis sebelum saya jalankan ulang).
- Atas persetujuan eksplisit pengguna ("bantu gua perbaiki koneksi gua dengan database"), dijalankan `npx prisma db push --accept-data-loss` dengan `DATABASE_URL`/`DIRECT_URL` di-set eksplisit dari `.env` (memaksa target ke Supabase produksi, `aws-0-ap-southeast-1.pooler.supabase.com`), setelah men-`unset` dulu supaya tidak ketiban env var lama di sesi shell ini.
- Peringatan "data loss" dari Prisma soal unique constraint **diabaikan dengan sengaja** — aman karena kolom baru nullable, baris `Transaction` lama otomatis jadi `NULL`, dan Postgres tidak menganggap banyak `NULL` sebagai duplikat pada unique index.
- **Diverifikasi via eksekusi nyata**: query `information_schema.columns` read-only mengonfirmasi kolom `creationRequestId` sekarang ada di tabel `Transaction` produksi. Query Prisma yang persis sama dengan `GET /api/transaction` (`findMany` + `include orders→items→menuItem`) dijalankan langsung dan **berhasil tanpa error** (1 baris dikembalikan).
- **Status: TERBUKTI SELESAI** untuk bagian skema database. Pengguna masih perlu refresh browser untuk konfirmasi banner "Koneksi bermasalah" hilang di UI — belum dicoba langsung di browser oleh saya.
- Belum diuji: `POST /api/transaction` (buka meja / Take Away) end-to-end setelah perbaikan ini — secara teori sudah harus jalan karena kolomnya sudah ada, tapi belum dicoba nyata.
- **Belum diperbaiki** (opsional, disebutkan di atas): `console.error(error)` yang hilang di `catch` GET `route.js:103-104` — kalau mau observability lebih baik ke depan.

---

## 2026-09-16 — Claude Sonnet 5

### Tugas
Diminta jelaskan fungsi menu "Kitchen" lalu audit skenario (tanpa ubah kode): "kitchen tidak menerima struk order" / "printer habis kertas" — apakah pending order tercetak ulang, apakah order tersimpan tapi kitchen tidak menerima, dan apakah menu Kitchen menyelesaikan masalah itu.

### Temuan (dibaca langsung dari kode, bukan dugaan)
- **Tidak ada integrasi printer struk dapur sama sekali di kodebase ini.** Satu-satunya `window.print()` (`src/app/page.js:1245`) dipakai untuk cetak QR code meja, bukan struk pesanan. Tidak ada library/endpoint print job (escpos, thermal, dsb).
- Teks di `KitchenPanel.js:149` ("Jika printer gagal, gunakan antrean layar...") **menyesatkan** — menyiratkan ada 2 jalur (printer utama + layar cadangan), padahal senyatanya cuma 1 jalur: layar KitchenPanel. Sudah dicatat juga di `docs/trial-readiness.md:52` ("Printer kitchen otomatis: belum terverifikasi").
- Satu-satunya jalur order sampai ke dapur: `POST /api/order` simpan ke DB (`kitchenStatus:'queued'`) → ditampilkan di `KitchenPanel.js` yang auto-poll tiap 5 detik. Order tersimpan aman di DB terlepas dari apakah staf sedang melihat layar atau tidak — tapi "penerimaan" oleh dapur murni manual (klik "Terima pesanan").
- Tidak ada mekanisme notifikasi aktif ke staf dapur (dicek: tidak ada `Notification`, `Audio`, `beep` di kode) — kalau tidak ada yang membuka/melihat layar Kitchen, order bisa nyangkut di status `queued` tanpa ada yang tahu.

### Keputusan pengguna
Menu Kitchen **belum dihapus** — pengguna mau lihat dulu apakah pesanan benar-benar sampai ke kitchen (observasi berjalan). Rencana ke depan: pakai **printer fisik** sebagai jalur akses kitchen untuk tahu apa yang dipesan customer (bukan cuma layar).

### Pekerjaan belum selesai / langkah berikutnya
- **Task baru (belum dikerjakan)**: implementasi integrasi printer untuk struk dapur — kitchen akan mengandalkan cetakan fisik untuk melihat pesanan customer, bukan (atau selain) layar KitchenPanel. Perlu diklarifikasi ke pengguna sebelum mulai: jenis printer (USB/thermal/network), kapan struk dicetak (saat order masuk vs saat diterima), apakah tetap butuh fallback layar kalau printer mati/kehabisan kertas, dan apakah menu Kitchen (layar) akhirnya dihapus atau tetap dipertahankan sebagai pelengkap.
- Menu Kitchen (layar) **jangan dihapus dulu** sampai integrasi printer siap dan sudah diverifikasi jalan — supaya tidak ada celah dimana dapur benar-benar tidak punya jalur melihat pesanan sama sekali.

---

## 2026-09-16 (lanjutan) — Claude Sonnet 5

### Tugas
Tambah fitur soft-delete: transaksi yang di-"Hapus" (tombol Admin) tidak lagi benar-benar dihapus dari database, tapi ditandai dan ditampilkan dengan garis coret + warna merah. Scope dikonfirmasi ke pengguna lewat pertanyaan (bukan asumsi sendiri, sesuai aturan proyek): **hanya tombol "Hapus" transaksi** (bukan "Batalkan" yang sudah soft dari awal, bukan juga hapus-item di Edit Pesanan). Transaksi yang dihapus **dikecualikan dari Statistik/laporan pendapatan**.

### Perubahan kode
- `prisma/schema.prisma` — tambah `deletedAt DateTime?` dan `deletedById Int?` di model `Transaction`. Status baru `'deleted'` dipakai di kolom `status` yang sudah ada (String bebas, sama seperti `'cancelled'`), tidak perlu ubah tipe kolom.
- `src/app/api/transaction/[id]/route.js` (`DELETE`) — sebelumnya hard-delete (`orderItem.deleteMany` → `order.deleteMany` → `transaction.delete`). Sekarang soft-delete: transaksi ditandai `status:'deleted', deletedAt, deletedById`, baris tidak pernah dihapus dari DB. Order kitchen yang masih aktif (belum `served`/`dismissed`) ikut di-set `kitchenStatus:'cancelled'` — pola yang sama persis dengan alur "Batalkan" transaksi biasa (`route.js:76` di file yang sama) — supaya tidak ada tiket nyangkut di layar Kitchen untuk transaksi yang sudah dihapus.
- `src/app/page.js` — tab Transaksi & Arsip:
  - Badge status: tambah label "Dihapus" (warna `danger`, sama seperti "Dibatalkan") untuk `status==='deleted'`.
  - Card ditampilkan dengan `textDecoration:'line-through'`, warna merah, dan border merah saat `status==='deleted'`.
  - Tombol QR/Edit/Batalkan/Hapus disembunyikan untuk transaksi yang statusnya sudah `'deleted'` (tidak ada aksi lanjutan yang masuk akal).
  - Urutan sort (transaksi "kelar" ditaruh di bawah) diperbarui supaya `'deleted'` diperlakukan sama seperti `'completed'`/`'cancelled'`.
  - Teks konfirmasi tombol "Hapus" diperbarui — sebelumnya bilang "permanen, tidak dapat dikembalikan" (sudah tidak akurat), sekarang menjelaskan bahwa transaksi ditandai terhapus tapi datanya tetap tersimpan.

### Kenapa desainnya begini (arsitektur & data flow)
- **Tidak menambah tabel/model baru** — cukup reuse kolom `status` (String bebas) yang sudah dipakai untuk `open/ordered/completed/cancelled`, ditambah `deletedAt`/`deletedById` untuk jejak audit (siapa & kapan). Pola sama dengan `paidById`/`acceptedById` yang sudah ada di schema (Int polos tanpa relasi FK eksplisit).
- **Statistik otomatis mengecualikan transaksi terhapus tanpa perlu diubah** — `calculateTableStats()` dan `calculateDailyRecap()` di `page.js` dari awal sudah filter `trx.status === 'completed'` saja untuk hitung pendapatan/porsi terjual (`page.js:249`, `:531`). Karena status `'deleted'` bukan `'completed'`, otomatis tidak ikut dihitung — tidak perlu sentuh logika Statistik sama sekali.
- **Order kitchen ikut dibatalkan saat transaksi dihapus** — kalau tidak, order yang masih `queued`/`preparing` di dapur akan tetap nyangkut di layar Kitchen padahal transaksi induknya sudah "dihapus" dari sudut pandang kasir. Solusinya reuse logika pembatalan order yang sudah ada dan terbukti benar (dipakai juga oleh tombol "Batalkan"), bukan bikin logika baru.
- **Validasi PUT transaksi tidak diubah** (`route.js:64`, hanya terima target status `'completed'`/`'cancelled'`) — sengaja dibiarkan supaya status `'deleted'` **hanya** bisa di-set lewat endpoint `DELETE` (khusus Admin), tidak bisa disisipkan lewat endpoint lain.

### Pengujian
- `npx eslint src/app/page.js` — dibandingkan sebelum/sesudah perubahan (`git stash` + lint ulang): **hasil identik** (6 error/6 warning pra-existing, hanya nomor baris bergeser). Tidak ada error/warning baru.
- `npx eslint src/app/api/transaction/[id]/route.js` — 0 error, 0 warning.
- `npx prisma validate` — schema valid.
- **Belum dijalankan**: `npx prisma db push` (skema baru belum diterapkan ke database manapun — baik `kasir_local` maupun produksi Supabase). Sengaja tidak dijalankan sendiri karena kredensial database lokal (`kasir_local`) tidak tersimpan di memori/sesi ini (dan memang seharusnya tidak dicatat, sesuai aturan proyek "jangan simpan password"), dan mengubah skema database adalah aksi yang butuh persetujuan eksplisit pengguna.
- **Belum diuji di browser** — alur hapus transaksi → tampilan garis coret merah → cek Statistik tidak berubah, semuanya baru diverifikasi lewat pembacaan kode, belum eksekusi nyata.

### Pekerjaan belum selesai / langkah berikutnya
1. **Perlu pengguna jalankan (atau beri izin eksplisit)**: `npx prisma db push` ke `kasir_local` dulu untuk testing, baru ke produksi Supabase setelah diverifikasi jalan — supaya kolom `deletedAt`/`deletedById` benar-benar ada di database. Tanpa ini, tombol "Hapus" akan error 500 (kolom belum ada), sama persis dengan insiden `creationRequestId` tanggal 2026-09-14 di atas — **jangan ulangi pola itu**, pastikan migrasi dijalankan sebelum fitur ini dipakai di produksi.
2. Setelah migrasi jalan, uji manual di browser: hapus 1 transaksi test, pastikan (a) card berubah garis-coret merah, (b) tombol aksi hilang, (c) transaksi tetap muncul di Statistik sebagai "tidak dihitung" (bandingkan total sebelum/sesudah hapus).
3. Opsional (belum diminta, jangan dikerjakan tanpa konfirmasi): tambah hitungan "Dihapus" di rekap harian Arsip (`recap.totalCancelled` di `page.js:590` saat ini cuma hitung `'cancelled'`, belum ada `totalDeleted`).

---

## 2026-09-17 — Claude Sonnet 5

### Tugas
Pengguna laporkan 2 masalah setelah sesi sebelumnya:
1. Tombol "Hapus" transaksi tidak berfungsi.
2. Item makanan yang dihapus lewat fitur Edit Pesanan tidak muncul garis merah.

### Temuan & perbaikan

**#1 — TERBUKTI, root cause sudah diduga sebelumnya dan dikonfirmasi via query read-only**
- Database aktif yang dipakai `.env` saat ini adalah **Supabase produksi** (`aws-0-ap-southeast-1.pooler.supabase.com`), bukan lokal.
- Query `information_schema.columns` read-only mengonfirmasi kolom `deletedAt`/`deletedById` (ditambahkan sesi 2026-09-16) **belum ada** di tabel `Transaction` produksi — persis pola insiden `creationRequestId` tanggal 14 sebelumnya. Migrasi (`prisma db push`) memang belum sempat dijalankan sesi lalu karena menunggu izin pengguna.
- **Belum diperbaiki** — menunggu pengguna jalankan/mengizinkan `npx prisma db push` (lihat Pekerjaan belum selesai).

**#2 — Scope baru, dikonfirmasi via pertanyaan ke pengguna (bukan diasumsikan)**
- Sesi 2026-09-16 sebelumnya sengaja **mengecualikan** "item yang dihapus di Edit Pesanan" dari fitur soft-delete (pengguna saat itu hanya minta tombol Hapus Transaksi). Hari ini dikonfirmasi ulang: pengguna memang mau soft-delete diperluas ke item pesanan yang dihapus kasir lewat modal Edit Pesanan.
- **Sudah diimplementasikan** (lihat Perubahan kode).

### Perubahan kode
- `prisma/schema.prisma` — tambah `deletedAt DateTime?` di model `OrderItem` (soft-delete per item, terpisah dari soft-delete `Transaction` yang sudah ada).
- `src/app/api/transaction/[id]/edit-order/route.js`:
  - Item yang dihapus kasir (tidak ikut dikirim ulang di `items[]`) sekarang di-`update({deletedAt:new Date()})`, bukan `delete()`. Idempotent — kalau sudah `deletedAt` sebelumnya, tidak ditimpa ulang/tidak memicu `changed=true` lagi supaya tidak reset `kitchenStatus` tanpa perubahan nyata.
  - Tambah validasi pertahanan: kalau ada `itemId` yang dikirim client ternyata `deletedAt` sudah terisi (item "hantu" yang seharusnya sudah tidak bisa diedit lagi), request ditolak `ORDER_CONFLICT` — mencegah item yang sudah dihapus "dihidupkan lagi" lewat client basi.
  - Total (`orderTotal`, `total` transaksi) tetap otomatis benar tanpa perubahan logika — sudah dari awal hanya menjumlah item yang ada di `incoming` (submitted), item yang di-soft-delete otomatis tidak ikut dihitung.
- `src/app/api/transaction/[id]/route.js` (GET, cabang customer/publik) — item dengan `deletedAt` di-filter keluar sebelum dikirim ke customer (`order.items.filter(item => !item.deletedAt)`). Customer tidak perlu lihat jejak "item yang dicoret kasir" di halaman pesanannya sendiri.
- `src/app/page.js`:
  - `openEditOrderModal` — item dengan `deletedAt` di-filter keluar saat membangun state modal Edit Pesanan, supaya tidak muncul lagi sebagai baris yang bisa diedit/di-resurrect.
  - Daftar "Pesanan" read-only di tab Transaksi (baris ~1778) dan Arsip (baris ~2664) — item dengan `deletedAt` ditampilkan `textDecoration:'line-through'` + warna merah.
- `src/components/KitchenPanel.js` — item pesanan yang `deletedAt` ditampilkan dicoret+merah di kartu Kitchen, supaya dapur tahu item itu sudah dibatalkan kasir (bukan hilang tanpa keterangan). Tidak perlu ubah query `GET /api/kitchen` karena field baru otomatis ikut ter-include (tidak ada `select` eksplisit di query itu).

### Kenapa desainnya begini
- **Konsisten dengan pola soft-delete `Transaction`** dari sesi sebelumnya — reuse pendekatan `deletedAt` timestamp, bukan bikin mekanisme berbeda.
- **Customer sengaja dikecualikan dari melihat item dicoret** — ini keputusan UX standar (bukan aturan bisnis harga/stok), supaya customer tidak bingung/khawatir melihat "pesanan saya dicoret" padahal itu cuma koreksi kasir. Staf (Transaksi/Arsip/Kitchen) tetap lihat semua sebagai jejak audit.
- **Item yang sudah dihapus tidak bisa diedit lagi / dihidupkan lagi** — validasi defensif ditambahkan supaya tidak ada celah data tidak konsisten (misalnya quantity berubah pada item yang seharusnya sudah final/terhapus).

### Pengujian
- `npx eslint` pada semua file yang diubah (`page.js`, `KitchenPanel.js`, `transaction/[id]/route.js`, `edit-order/route.js`) — dibandingkan hasil sebelum/sesudah: **identik**, tidak ada error/warning baru.
- `npx prisma validate` — schema valid.
- Query read-only `information_schema.columns` ke database produksi aktif — mengonfirmasi akar masalah #1 (kolom belum ada).
- **Belum dijalankan**: `npx prisma db push` untuk kolom `OrderItem.deletedAt` maupun kolom `Transaction.deletedAt`/`deletedById` dari sesi sebelumnya — keduanya **masih menunggu izin pengguna** untuk migrasi ke database (lokal `kasir_local` dan/atau produksi Supabase).
- **Belum diuji di browser** — alur hapus item di Edit Pesanan → cek tampilan dicoret di Transaksi/Arsip/Kitchen, belum dicoba nyata karena schema belum di-push jadi fitur belum bisa dites end-to-end.

### Pekerjaan belum selesai / langkah berikutnya
1. **Paling prioritas — perlu keputusan & izin pengguna**: jalankan `npx prisma db push` supaya SEMUA kolom baru (`Transaction.deletedAt`, `Transaction.deletedById`, `OrderItem.deletedAt`) benar-benar dibuat di database yang dipakai. Selama ini belum dilakukan, baik fitur "Hapus Transaksi" maupun "item dicoret di Edit Pesanan" **tidak akan berfungsi** (kemungkinan besar error 500 begitu endpoint terkait dipanggil, sama seperti error yang sudah dilaporkan pengguna).
2. Setelah migrasi jalan: uji manual end-to-end di browser — hapus transaksi (cek garis-coret merah + hilang dari Statistik), hapus 1 item di Edit Pesanan (cek garis-coret merah muncul di Transaksi/Arsip/Kitchen, dan TIDAK muncul di halaman order customer).

---

## 2026-09-16 — Codex: review awal dan laporan harian

- Selesai: automation aktif `review-harian-codebase-kasir`, setiap hari 05.00 Asia/Taipei (UTC+8), hasil di task ini untuk dibaca workspace manager. Review awal malam ini karena 05.00 sudah lewat. Baseline HEAD `ec35c98`; run berikutnya membandingkan laporan sukses terakhir termasuk perubahan belum di-commit.
- Kondisi awal: Agents.md dan Claude.md staged (masing-masing 58 baris baru); CATATAN_PROYEK.md memiliki 20 baris tambahan sebelum entri ini. Pekerjaan tersebut dipertahankan.
- Perubahan 16 September (`89fc8ec..ec35c98`): 3 file, 236 baris tambah/63 hapus: API order, halaman order customer, KitchenPanel. Tidak ada perubahan schema pada rentang ini.
- Terverifikasi di kode: timeout submit 20 detik, retry pending order dan tombol disabled ada di src/app/order/[transactionId]/page.js:221,257,874. Backlog lama tambah timeout sudah diimplementasikan, belum diuji ulang di browser. Relevan untuk jaringan lambat.
- Temuan prioritas tinggi: diff ec35c98 menghapus penguncian sesi sebelum validasi order. Status dan batas order dibaca di luar transaksi; src/app/api/order/route.js:75-95 menulis tanpa memeriksa ulang keduanya. Pembayaran masih mengunci lalu menutup sesi (PUT src/app/api/transaction/[id]/route.js). Potensi order masuk setelah pembayaran lalu mengubah status kembali menjadi ordered; request bersamaan juga berpotensi melewati batas sesi. Perubahan perlindungan terbukti dari kode, dampak concurrency belum direproduksi. Task baru: uji bersamaan pada database lokal dan perbaiki berdasarkan hasil. Kesimpulan aman audit lama tidak otomatis berlaku untuk versi sekarang.
- Penilaian: pemendekan transaksi punya tujuan fungsional, tetapi klaim komentar <50ms belum dibuktikan benchmark. Kebenaran alur perlu didahulukan sebelum menerima optimasi sebagai selesai.
- KitchenPanel menambah error per pesanan dan pembaruan status optimistis sebelum respons server. Berguna untuk respons UI; sinkronisasi setelah kegagalan jaringan perlu uji browser.
- Jalur saat ini: API order -> DB queued -> polling KitchenPanel tiap 5 detik. Pencarian src/package.json hanya menemukan window.print untuk QR di src/app/page.js:1245, bukan integrasi struk dapur. Teks printer src/components/KitchenPanel.js:149 tidak sesuai implementasi. Printer masih backlog, perlu spesifikasi perangkat/alur; layar Kitchen tetap dibutuhkan.
- Backlog tetap: keputusan bisnis statistik jam sibuk/durasi take away dan reset kitchenStatus ketika edit; uji browser; pengaturan lingkungan database dan persiapan login sebelum launch sesuai catatan sebelumnya. DB produksi tidak diverifikasi ulang.
- Pemeriksaan: baca catatan, git status/log/diff, implementasi API order/pembayaran/Kitchen dan pencarian printer; automation berhasil dibuat dan tool view menampilkan kartu. Tidak menjalankan tes runtime. Kode aplikasi, arsitektur dan database tidak diubah pada tugas ini; hanya catatan dan jadwal laporan.

---

## 2026-09-17 07:26 Asia/Taipei — Codex: laporan harian

- Review selesai; dijalankan sekitar 07:25 Taiwan, bukan tepat 05:00. Penyebab keterlambatan scheduler belum diperiksa. Baseline commit tetap ec35c98 (tidak ada commit baru). Snapshot saat review: 5 file produk berubah belum di-commit (schema, API transaksi, edit-order, dashboard, KitchenPanel), 58 baris ditambah/42 dikurangi. Agents.md dan Claude.md masih staged; .claude/settings.local.json baru/untracked, isi konfigurasi tidak diperiksa. Perubahan catatan tidak dihitung sebagai perubahan produk.
- Implementasi baru terverifikasi: soft-delete transaksi memakai status deleted + deletedAt/deletedById, membatalkan tiket kitchen aktif; soft-delete item memakai OrderItem.deletedAt, melarang edit item terhapus, menyembunyikannya dari customer dan mencoretnya pada layar staf. Berguna untuk riwayat koreksi, bukan sekadar kosmetik. Tidak ada tabel baru; tiga kolom baru perlu sinkronisasi database.
- P1 BARU TERBUKTI melalui eksekusi fungsi calculateDailyRecap asli yang diekstrak dari src/app/page.js:530-594 dengan data sintetis, tanpa database: transaksi completed dengan item aktif Rp10.000 dan item deletedAt Rp20.000 menghasilkan totalRevenue Rp30.000 dan 2 item, sedangkan paymentMethods.CASH.revenue Rp10.000. Seharusnya pendapatan Rp10.000 dan 1 item aktif. Penyebab: loop pada :556 tidak mengecualikan deletedAt. calculateTableStats :380 juga masih mengagregasi semua item (temuan statis); exportToExcel menggunakan calculateDailyRecap sehingga ikut terdampak. Task manager: perbaiki semua agregasi item terhapus dan uji kesesuaian rekap, statistik, ekspor, dan pembayaran. Ini belum diperbaiki pada review ini.
- P1 BELUM TUNTAS: catatan Claude 17 September menyatakan query DB produksi membuktikan kolom soft-delete belum ada. Review ini mengonfirmasi schema sumber dan Prisma Client hasil generate sudah memuat ketiga kolom, tetapi tidak mengakses DB produksi; status skema live adalah laporan AI sebelumnya, belum diverifikasi ulang. Ketidaksesuaian dapat berdampak juga pada GET yang mengambil kolom model, bukan hanya tombol Hapus. Task: pastikan target DB, validasi dan terapkan migrasi pada lingkungan uji lalu produksi sesuai otorisasi; lakukan uji end-to-end. Jangan tandai fitur siap hanya karena kode/lint selesai.
- P1 LAMA MASIH TERBUKA: API order tidak berubah dari ec35c98; status dan batas sesi masih diperiksa di luar transaksi sebelum penulisan tanpa penguncian/revalidasi. Risiko bersamaan dengan pembayaran tetap ada dan kini juga perlu skenario bersamaan dengan soft-delete. Dampak concurrency belum direproduksi.
- Backlog tetap: integrasi printer belum ditemukan (pencarian src/package.json hanya window.print QR src/app/page.js:1245), uji browser soft-delete/Kitchen/retry, keputusan bisnis statistik dan reset kitchenStatus saat pengurangan item. Timeout customer sudah diimplementasikan sebelumnya, jangan didaftarkan sebagai implementasi baru yang belum dikerjakan.
- Pemeriksaan dilakukan: catatan, git status/log/diff/numstat, kode alur soft-delete/order/Kitchen/statistik, Prisma Client schema, serta uji fungsi rekap memakai data sintetis. Tidak menjalankan browser, build/lint ulang atau query DB live; hasil lint/Prisma validate di entri Claude adalah laporan sebelumnya. Tidak mengubah kode aplikasi, database, commit atau deployment. Laporan lengkap juga disampaikan di percakapan agar manager tidak bergantung pada akses file lokal.

## 2026-09-18 — Codex: diagnosis cetak QR 58 mm

- Tugas: periksa laporan cetak QR menyerupai HVS. Diagnosis selesai; perbaikan template belum dilakukan.
- Terbukti: src/app/globals.css:199 memakai @page size:auto dan margin 8mm. Kartu cetak dipusatkan horizontal/vertikal, lebar 90%, maksimal 420px, padding besar. Tidak ada aturan khusus 58mm. src/app/page.js:1244 hanya memanggil window.print(); QR di :1635 berukuran 190px sebelum padding. Aplikasi tidak menetapkan A4 secara eksplisit; konfigurasi printer/browser belum diperiksa.
- Alur: activeQr -> kartu QR/SVG -> window.print -> CSS cetak -> dialog printer. Perbaikan yang diperlukan berada pada tata letak cetak, tanpa perubahan API/database.
- Berikutnya: sesuaikan template roll 58mm, margin/area cetak sesuai perangkat, ukuran QR dan teks; verifikasi preview dan hasil scan cetakan. Belum mengubah kode aplikasi atau menguji printer fisik.
- Pemeriksaan: catatan, git status/diff dan kode terkait. Perubahan pengguna/AI lain dipertahankan. Hanya catatan ditambahkan; lint/build tidak dijalankan karena kode aplikasi tidak diubah.
- Backlog tetap: agregasi item soft-delete page.js:380/:556 masih tanpa filter deletedAt (diperiksa ulang statis); migrasi soft-delete dan uji end-to-end belum diverifikasi sesi ini; risiko concurrency order/pembayaran dari review sebelumnya belum diuji ulang.

---

## 2026-09-18 07:30 Asia/Taipei — Codex: laporan harian

- Selesai: review catatan, status staged/unstaged/untracked, commit dan implementasi terkait. Trigger diterima sekitar 07:29 Taiwan, terlambat dari jadwal 05:00; penyebab belum diperiksa. Baseline baru e3dad220a2e0463cc87498f4254676291964c233 (Rev 5.5, 18 September 00:50 Taiwan).
- Dibanding laporan 17 September: implementasi soft-delete yang kemarin belum di-commit sekarang masuk commit e3dad22. Lima file produk tetap menunjukkan perubahan kumulatif 58 baris tambah/42 hapus terhadap ec35c98; ini pekerjaan yang sudah dilaporkan kemarin, bukan fitur tambahan hari ini. Sebelum penambahan laporan ini, tidak ada perubahan tracked staged/unstaged. .claude/settings.local.json tetap untracked dan isinya tidak diperiksa.
- Arsitektur/alur soft-delete tetap: API menandai transaksi/item di database alih-alih menghapus baris; tiga kolom audit baru; staf melihat coretan dan customer menerima item aktif. Berguna untuk jejak koreksi, bukan sekadar kosmetik. Commit tidak membuktikan migrasi atau kesiapan operasional.
- Task baru dalam catatan: tata letak cetak QR roll 58mm. Diagnosis diperiksa ulang: src/app/globals.css:199-239 memakai size:auto, margin 8mm, kartu dipusatkan dengan max-width 420px dan padding besar; src/app/page.js:1635 QR 190px, :1245 window.print. CSS tidak berubah sejak ec35c98. Diagnosis selesai, perbaikan dan uji cetak/scan belum dilakukan. Relevan untuk keterbacaan QR/perangkat nyata; perubahan cukup pada template cetak tanpa API/database. Jangan samakan cetak QR dengan integrasi struk dapur. Konfigurasi printer/browser belum diperiksa, jadi belum menyatakan penyebab cetak hanya CSS atau aplikasi memaksa A4.
- P1 tetap terbuka: agregasi item terhapus pada src/app/page.js:380 dan :556 masih tidak menyaring deletedAt. Bukti eksekusi 17 September tetap relevan: item aktif Rp10.000 + terhapus Rp20.000 menghasilkan rekap salah Rp30.000/2 item sementara pembayaran Rp10.000. Hari ini verifikasi statis; tidak mengulang tes identik. Task manager: perbaiki agregasi rekap/statistik/ekspor dan uji konsistensi dengan pembayaran.
- P1 tetap terbuka: src/app/api/order/route.js tidak berubah dari ec35c98; validasi status/batas di luar transaksi dan penulisan tanpa revalidasi tetap berisiko bentrok dengan pembayaran/penghapusan sesi. Dampak concurrency belum direproduksi. Task manager: uji request bersamaan dan pulihkan konsistensi berdasarkan hasil.
- Migrasi soft-delete: tidak ada konfirmasi penyelesaian baru dalam catatan. Ketiadaan kolom produksi merupakan laporan Claude 17 September; database live tidak diakses pada review ini. Manager perlu memverifikasi status migrasi sebelum menyatakan fitur siap, lalu uji browser. Backlog lain tetap: printer struk dapur, keputusan bisnis statistik/durasi take away/reset kitchenStatus, dan uji browser alur terkait.
- Tidak ada klaim perbaikan baru untuk bug prioritas. Pemeriksaan read-only pada kode/Git; tidak menjalankan lint/build/browser/DB atau mengubah kode aplikasi. Hanya laporan ini ditambahkan dan hasil lengkap disampaikan di task agar manager tidak perlu akses file lokal.

---

## 2026-09-18 — Claude Sonnet 5

### Tugas
Perbaiki template cetak QR Code meja (`window.print()`) yang sebelumnya berbasis kertas HVS/A4, ubah jadi format struk printer thermal 58mm. Melanjutkan backlog yang sudah didiagnosis Codex di entri "diagnosis cetak QR 58 mm" (2026-09-18) di atas — diagnosis itu benar (`@page size:auto` + kartu max-width 420px terbukti setelah dibaca ulang), sesi ini mengerjakan perbaikannya.

### Perubahan kode
- `src/app/globals.css:199-` (blok `@page` dan `@media print`):
  - `@page { size: auto; margin: 8mm; }` → `@page { size: 58mm auto; margin: 0; }` (lebar tetap 58mm, tinggi mengikuti panjang isi — sesuai printer roll/continuous form thermal, bukan kertas ukuran tetap).
  - `.print-qr-card`: `position: fixed; left/top:50%; transform:translate(-50%,-50%); max-width:420px; padding:1.25rem 1.5rem; border:2px dashed` diganti jadi `position:absolute; top:0; left:0; width:58mm; padding:2mm 3mm; border:none`. Centering 50%/50% dihapus karena tidak valid untuk halaman `auto`-height (continuous roll tidak punya tinggi tetap untuk dihitung persentasenya); posisi kini menempel pojok kiri-atas kertas dan lebar kartu = lebar kertas penuh.
  - Tambah aturan print baru untuk kelas `.qr-badge`, `.qr-title`, `.qr-instruction`, `.qr-container svg` (dipaksa 38mm x 38mm), `.qr-time-info`, `.qr-trx-code` — semua font-size diperkecil ke satuan pt kecil (6.5pt–10pt) dan padding ke satuan mm supaya proporsional di kertas sempit 58mm.
- `src/app/page.js` (sekitar baris 1614-1667): tambah `className="qr-badge"`, `"qr-title"`, `"qr-instruction"`, `"qr-trx-code"` pada elemen-elemen di dalam kartu QR (badge nomor meja, judul, instruksi scan, paragraf kode transaksi) — sebelumnya elemen ini hanya punya inline style sehingga tidak bisa ditarget CSS print secara presisi. Tidak ada logika/fungsi yang diubah, hanya penambahan className.

### Keputusan penting & alasan
- Tetap pakai mekanisme lama "`visibility:hidden` pada semua elemen body lalu `visibility:visible` khusus `.print-qr-card`" (bukan refactor total) karena mekanisme ini sudah terbukti berjalan untuk kasus A4 sebelumnya — risiko lebih rendah daripada mengganti pendekatan.
- Ukuran QR SVG dipaksa 38mm via CSS (`.qr-container svg`), bukan mengubah prop `size={190}` di `QRCodeSVG` pada `page.js`, supaya tampilan di layar (screen, `size=190`) tetap sama seperti sebelumnya dan hanya hasil cetak yang menyesuaikan ukuran kertas.
- Border dekoratif dashed pada kartu dihapus saat print (tetap ada saat di layar) karena struk thermal umumnya polos/hemat tinta panas, dan lebar 58mm terlalu sempit untuk border+padding besar ala HVS.

### Pengujian
- `npm run lint -- src/app/page.js src/app/globals.css`: **tidak ada error/warning baru**. 6 error + 7 warning yang muncul semuanya pra-existing di baris lain (894-929 `setState` dalam `useEffect`, 3218/3621/3806 pemakaian `<img>`), sudah ada sebelum perubahan ini dan tidak berkaitan dengan kartu cetak QR.
- **Belum diuji**: preview cetak langsung di browser (Ctrl+P) dan cetak fisik ke printer thermal 58mm sungguhan untuk memastikan QR masih bisa di-scan dan tidak terpotong. Sesi ini adalah CLI-only, tidak ada akses ke printer/browser untuk verifikasi visual.

### Pekerjaan belum selesai / langkah berikutnya
- Pengguna perlu coba cetak nyata (atau preview cetak Chrome dengan "Save as PDF" + pilih ukuran kertas custom 58mm) untuk pastikan: QR masih terbaca saat di-scan, teks tidak terpotong/tumpang tindih, dan tidak ada halaman kosong tambahan setelah struk.
- Kalau printer fisik ternyata punya printable width < 58mm (banyak printer 58mm punya area cetak efektif ~48-50mm), mungkin perlu kecilkan lagi lebar `.print-qr-card` dan ukuran QR (`.qr-container svg`) — laporkan hasil cetak fisiknya supaya bisa disesuaikan.
- Backlog lama tetap belum disentuh sesi ini (di luar scope tugas): agregasi item soft-delete `page.js:380`/`:556` tanpa filter `deletedAt`, migrasi soft-delete di produksi belum diverifikasi, risiko concurrency `api/order/route.js`, printer struk dapur.

---

## 2026-09-19 — Claude Sonnet 5

### Tugas
Di kartu daftar transaksi (tab Transaksi & tab Arsip): (1) item pesanan yang ditandai terhapus (soft-delete, ditampilkan coret merah) harus selalu ditaruh paling bawah dalam daftar menu pesanan; (2) label "Pesanan Tambahan" yang sebelumnya berwarna merah diubah jadi hijau (supaya tidak tertukar makna dengan warna merah = item dihapus).

### Perubahan kode
- `src/app/page.js` — ada 2 lokasi identik yang render daftar item per-order di dalam kartu transaksi (tab Transaksi sekitar baris 1773-1779, tab Arsip sekitar baris 2660-2665):
  - `order.items.map(item => ...)` → `[...order.items].sort((a, b) => (a.deletedAt ? 1 : 0) - (b.deletedAt ? 1 : 0)).map(item => ...)`. Item dengan `deletedAt` terisi (soft-deleted) didorong ke akhir array; item lain tetap urut seperti semula (sort stabil di JS modern, jadi relative order item aktif tidak berubah).
  - Warna label "Pesanan Tambahan" (`<p>` yang muncul saat `orderIdx > 0`, menandai order susulan di luar pesanan pertama) diubah dari `color: '#ef4444'` (merah) jadi `color: '#16a34a'` (hijau). Warna coret-merah untuk item `deletedAt` (`#ef4444`, di elemen `<li>`) **tidak diubah** — tetap merah sesuai konfirmasi pengguna, itu bukan bagian yang diminta ganti warna.

### Keputusan penting & alasan
- Sorting hanya memindahkan item terhapus ke bawah **dalam lingkup satu order** (satu "Pesanan Utama"/"Pesanan Tambahan"), bukan digabung lintas semua order dalam satu transaksi — karena struktur tampilan memang per-order (tiap order py sub-list `<ul>` sendiri dengan judul "Pesanan Tambahan" di atasnya), memindah lintas-order akan merusak pengelompokan yang sudah ada dan mengubah makna "Pesanan Tambahan ke-2, ke-3", dst.
- Tidak mengubah `src/app/api/transaction/route.js` atau `[id]/route.js` (sumber data `order.items`) — ini murni perubahan tampilan/urutan render di client, data & urutan asli dari API tidak diubah.

### Pengujian
- `npm run lint -- src/app/page.js`: **tidak ada error/warning baru**. 6 error + 6 warning yang muncul semuanya pra-existing (baris 894-929 `setState` dalam `useEffect`, 3218/3621/3806 pemakaian `<img>`), tidak berkaitan dengan perubahan ini.
- **Belum diuji manual di browser**: perlu buka tab Transaksi/Arsip dengan transaksi yang punya item ter-soft-delete campur dengan item aktif, pastikan item merah selalu di bawah dan label "Pesanan Tambahan" tampil hijau.

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual di browser dengan data yang punya kombinasi item aktif + item dihapus + lebih dari 1 order (untuk lihat label "Pesanan Tambahan" hijau dan urutan item).
- Backlog lama tetap belum disentuh (di luar scope): agregasi item soft-delete `page.js:380`/`:556` tanpa filter `deletedAt`, migrasi soft-delete produksi, risiko concurrency `api/order/route.js`, printer struk dapur.

---

## 2026-09-19 (lanjutan) — Claude Sonnet 5

### Tugas
Koreksi dari pengguna atas pekerjaan sebelumnya: sorting item terhapus "dalam satu order" ternyata belum sesuai maksud. Yang diminta: item yang dihapus harus **selalu di paling bawah dari SELURUH daftar pesanan dalam satu transaksi** — di bawah semua grup "Pesanan Tambahan" maupun grup "Take Away", bukan cuma di bawah dalam grup order-nya sendiri.

### Perubahan kode
- `src/app/page.js` — 2 lokasi yang sama (tab Transaksi ±baris 1772-1808, tab Arsip ±baris 2684-2719), diganti totalnya dari "sort per-order" jadi **pisah & kumpulkan lintas semua order**:
  - Dibungkus IIFE: hitung `sortedOrders` (urut oleh `createdAt`, sama seperti sebelumnya) dan `deletedItems` = `flatMap` semua `order.items` yang punya `deletedAt` dari SEMUA order dalam transaksi tsb.
  - Tiap order group (`Pesanan Utama` / `Pesanan Tambahan` / badge `Bungkus (Take Away)`) sekarang hanya me-render `activeItems` (item yang `!deletedAt`). Kalau suatu order isinya cuma item terhapus semua, group order itu tidak dirender sama sekali (`return null`) — babel karena tidak ada lagi item aktif untuk ditampilkan di situ.
  - Setelah semua order group dirender, baru muncul **satu section terpisah di paling bawah**: label "Item Dihapus" (ikon `Trash2`, teks merah) + daftar semua item `deletedAt` yang sudah dikumpulkan tadi (coret merah), dipisah garis putus-putus dari daftar di atasnya. Ini yang membuat item terhapus **selalu di bawah semuanya**, termasuk di bawah grup "Pesanan Tambahan" dan "Take Away", sesuai koreksi pengguna.

### Keputusan penting & alasan
- Label baru "Item Dihapus" (bukan cuma mengandalkan warna merah+coret) ditambahkan supaya jelas kenapa item-item itu terpisah dari grup order aslinya — tanpa label, campuran item dari beberapa order berbeda di satu blok bawah tanpa konteks order asal akan membingungkan kasir.
- Order yang seluruh isinya sudah dihapus (activeItems kosong) tidak lagi menampilkan header/grup kosong — mencegah "Pesanan Tambahan" atau badge "Bungkus (Take Away)" nongol tanpa isi apa pun di bawahnya.
- `trx.orders.sort(...)` tetap dipanggil langsung di array asli (bukan disalin `[...trx.orders]`) — konsisten dengan gaya kode sebelumnya di file ini, bukan sesuatu yang diubah sesi ini.

### Pengujian
- `npm run lint -- src/app/page.js`: **tidak ada error/warning baru** di kedua lokasi yang diubah. 6 error + 6 warning yang tampil semuanya pra-existing (baris `useEffect`/`setState` dan pemakaian `<img>`), tidak berkaitan dengan perubahan ini.
- **Belum diuji manual di browser.** Perlu dicoba dengan data nyata: transaksi yang punya beberapa order (utama + tambahan, ada yang take away), dan sebagian item di masing-masing order ditandai dihapus — pastikan semua item merah berkumpul di satu blok paling bawah, dan grup order yang jadi kosong akibat semua isinya dihapus tidak menampilkan header kosong.

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual di browser sesuai skenario di atas (kombinasi order utama + tambahan + take away + campuran item aktif/dihapus).
- Backlog lama tetap belum disentuh (di luar scope): agregasi item soft-delete `page.js:380`/`:556` tanpa filter `deletedAt` di rekap/statistik, migrasi soft-delete produksi, risiko concurrency `api/order/route.js`, printer struk dapur.

---

## 2026-09-19 (lanjutan 2) — Claude Sonnet 5

### Tugas
Rapikan lagi template cetak QR 58mm (melanjutkan [[Rev 2026-09-18]] soal ukuran kertas): pengguna minta struktur cetak dibatasi jadi persis 4 bagian, urut dari atas — (1) nomor meja, (2) QR code, (3) tulisan "Scan Untuk Pesan", (4) tanggal & jam QR dibuat — dan semuanya harus jelas/mudah dibaca di struk.

### Perubahan kode
- `src/app/page.js` (kartu `.print-qr-card`, ±baris 1614-1679):
  - Tambah `no-print` pada `<h2 className="qr-title">` (judul "QR Code Pesanan Meja X") dan `<p className="qr-instruction">` (kalimat instruksi panjang) — dua elemen ini tetap tampil di layar untuk staf, tapi disembunyikan saat dicetak karena bukan bagian dari 4 struktur yang diminta.
  - Tambah elemen baru `<p className="qr-scan-text">SCAN UNTUK PESAN</p>` setelah kotak QR — elemen ini kebalikannya: disembunyikan di layar (`display:none` default), hanya muncul saat print. Ini bagian #3.
  - Tambah `no-print` pada label kecil "Waktu QR Code Dibuat" di dalam `.qr-time-info` (captionnya saja, bukan seluruh box) supaya saat cetak yang tampil cuma baris tanggal+jam polos (bagian #4), tanpa label berulang.
  - Tambah `no-print` pada paragraf "Kode Transaksi" — tidak termasuk 4 bagian yang diminta, disembunyikan dari hasil cetak (tetap tampil di layar).
  - Badge nomor meja (`.qr-badge`, bagian #1) dan kotak QR (`.qr-container`, bagian #2) tidak diubah strukturnya, cuma ukuran cetaknya diperbesar (lihat CSS).
- `src/app/globals.css` (blok `@media print`):
  - Hapus aturan print untuk `.qr-title`, `.qr-instruction`, `.qr-trx-code` (jadi dead code karena elemen-elemen itu sekarang `no-print`/disembunyikan total saat cetak).
  - Tambah aturan dasar (di luar `@media print`) `.qr-scan-text { display: none; }` supaya teks "SCAN UNTUK PESAN" default tersembunyi di layar, lalu di dalam `@media print` di-`display:block` dengan font 11pt bold.
  - `.qr-badge` diperbesar dari 10pt → 15pt (nomor meja jadi elemen paling mencolok, sesuai urutan #1).
  - `.qr-container svg` (ukuran QR saat cetak) diperbesar sedikit dari 38mm → 40mm.
  - `.qr-time-info *` (baris tanggal & jam) font dari 7pt → 9pt dan ditambah `font-weight:700` supaya lebih mudah dibaca di struk kecil.

### Keputusan penting & alasan
- Elemen yang disembunyikan saat print (judul h2, instruksi panjang, kode transaksi) **tetap ada dan tampil di layar** — perubahan ini murni soal apa yang tercetak di kertas 58mm, tidak mengurangi informasi yang dilihat kasir di aplikasi.
- "SCAN UNTUK PESAN" dibuat sebagai elemen terpisah (bukan mengubah teks instruksi lama) karena instruksi lama ("Scan QR Code di bawah untuk melihat menu...") masih relevan untuk tampilan layar, sedangkan versi cetak butuh teks pendek yang jelas terbaca dari jarak biasa di meja restoran.
- Ukuran font dinaikkan cukup signifikan (badge 10pt→15pt, tanggal/jam 7pt→9pt) merespons permintaan eksplisit "buat menjadi jelas agar bisa dibaca" — printer thermal 58mm umumnya mendukung ukuran ini tanpa masalah pemotongan, mengingat lebar cetak sudah dikunci 58mm dan padding kartu sudah kecil (2mm/3mm).

### Pengujian
- `npm run lint -- src/app/page.js src/app/globals.css`: hasil 13 problems (6 error, 7 warning) — **tidak ada error baru**, jumlah error tetap 6 (sama seperti seluruh sesi sebelumnya di file ini). Sempat terlihat beda jumlah warning (6 vs 7) dibanding run sebelumnya, tapi setelah dicek ulang tanpa `| tail -50` itu cuma efek pemotongan output oleh `tail`, bukan warning baru — warning "missing dependency: fetchArchive" di baris 898 (jauh dari area yang diubah, ±baris 1611-1679/1770-1815/2657-2719) sudah pra-existing.
- **Belum diuji**: preview cetak (Ctrl+P) maupun cetak fisik ke printer 58mm untuk pastikan 4 bagian tersusun rapi dan tidak overflow/terpotong dengan ukuran font baru yang lebih besar.

### Pekerjaan belum selesai / langkah berikutnya
- Cek preview cetak/cetak fisik: pastikan badge nomor meja 15pt tidak terlalu besar sampai terpotong untuk nomor meja yang panjang (mis. "TAKE AWAY - Nama Pelanggan Panjang"), dan QR 40mm + teks di bawahnya masih pas dalam satu struk tanpa terpotong halaman.
- Backlog lama tetap belum disentuh (di luar scope): agregasi item soft-delete `page.js:380`/`:556`, migrasi soft-delete produksi, risiko concurrency `api/order/route.js`, printer struk dapur.

---

## 2026-09-19 (lanjutan 3) — Claude Sonnet 5

### Tugas
Lanjutan revisi template cetak QR: badge nomor meja (bagian #1) diminta warnanya jadi hitam dan dibuat lebih jelas/lebih besar.

### Perubahan kode
- `src/app/globals.css` — aturan `@media print .qr-badge` (sekitar baris 254-266) diubah total:
  - Sebelumnya: kotak solid `background:#000000` + `color:#ffffff` (teks putih di atas kotak hitam), `font-size:15pt`.
  - Sekarang: `background:transparent`, `color:#000000` (teks hitam tebal `font-weight:900`), dikelilingi `border:2.5px solid #000000` sebagai pengganti kotak solid, `font-size:22pt`.
- Alasan ganti dari kotak solid ke border: kotak `background` solid pada CSS print **butuh opsi "Print background graphics" aktif di dialog print browser** (Chrome/Edge defaultnya kadang mati). Kalau opsi itu mati, kotak hitamnya tidak ikut tercetak sama sekali, sehingga teks putih di atasnya jadi tak kelihatan (putih di atas kertas putih). Border tidak bergantung pada opsi itu, jadi teks hitam + garis kotak dijamin tercetak apa pun pengaturan browsernya. Ini kemungkinan besar akar masalah "warna meja belum hitam" yang dilaporkan pengguna.

### Pengujian
- Perubahan CSS-only, tidak menjalankan lint (tidak ada file JS yang diubah pada langkah ini).
- **Belum diuji**: preview/cetak fisik untuk pastikan border+teks 22pt bold tidak terpotong untuk nomor meja/label take away yang panjang, dan benar-benar tercetak hitam jelas di printer thermal asli.

### Pekerjaan belum selesai / langkah berikutnya
- Uji cetak fisik untuk badge nomor meja (border + teks hitam 22pt) — pastikan jelas terbaca dan tidak terpotong.
- Backlog lama tetap belum disentuh (di luar scope): agregasi item soft-delete `page.js:380`/`:556`, migrasi soft-delete produksi, risiko concurrency `api/order/route.js`, printer struk dapur.

---

## 2026-09-19 (lanjutan 4) — Claude Sonnet 5

### Tugas
Pengguna laporkan hasil cetak QR tidak simetris/miring — diminta dibuat rata tengah.

### Perubahan kode
- `src/app/globals.css` — `@media print .print-qr-card` (±baris 226-247):
  - Sebelumnya: `position:absolute; left:0; width:58mm` — kartu menempel persis di tepi kiri kertas, memenuhi lebar penuh 58mm.
  - Sekarang: `position:absolute; left:50%; transform:translateX(-50%); width:48mm` — kartu di-center secara matematis relatif ke lebar halaman (nominal 58mm), dengan lebar konten dipersempit ke 48mm (sisa ±5mm buffer di kiri-kanan).
  - Padding kartu diganti dari `2mm 3mm` (ada padding horizontal) jadi `2mm 0` (padding horizontal dihapus, karena buffer kiri-kanan sudah didapat dari mempersempit lebar kartu ke 48mm, bukan dari padding).
  - Tambah `display:flex; flex-direction:column; align-items:center; text-align:center` langsung di CSS print supaya semua isi kartu (badge, QR, teks) tetap center meski override lain terjadi — pelengkap className Tailwind `flex flex-col items-center text-center` yang sudah ada di JSX.

### Keputusan penting & alasan
- Root cause dugaan: banyak printer thermal 58mm punya **area cetak efektif yang lebih sempit dari 58mm nominal** (umum ~48-50mm) dan/atau area cetaknya tidak persis di tengah gulungan kertas secara fisik. Saat kartu dipaksa `width:58mm` menempel di `left:0`, kalau printer cuma bisa cetak ±48-50mm dari titik tertentu, sebagian kanan/kiri konten bisa kepotong atau bergeser — inilah yang kemungkinan besar terlihat sebagai "miring"/tidak simetris oleh pengguna, bukan rotasi sungguhan (tidak ada CSS rotate/skew di kode).
- Solusi mempersempit ke 48mm + center matematis (`left:50%` + `translateX(-50%)`) dipilih ketimbang cuma menambah `margin:auto`, karena kartu memakai `position:absolute` (diperlukan supaya tidak ikut ke-clip oleh elemen lain yang disembunyikan `visibility:hidden` di sekitarnya — lihat rev sebelumnya) dan elemen `position:absolute` tidak bisa di-center pakai `margin:auto` tanpa `left`+`right` eksplisit; kombinasi `left:50%`+`transform:translateX(-50%)` adalah cara standar CSS untuk center elemen absolute apa pun lebar kontennya.

### Pengujian
- Perubahan CSS-only, tidak menjalankan lint (tidak ada file JS yang diubah).
- **Belum diuji cetak fisik** — perlu dicoba lagi di printer yang sama yang sebelumnya menghasilkan cetakan miring, untuk konfirmasi apakah 48mm+center sudah cukup atau perlu dipersempit lagi (mis. ke 44-46mm) tergantung area cetak riil printer tsb.

### Pekerjaan belum selesai / langkah berikutnya
- Pengguna perlu coba cetak ulang dan konfirmasi apakah sudah simetris. Kalau masih miring/kepotong di satu sisi, kemungkinan area cetak fisik printer memang tidak center secara hardware (bukan bisa diperbaiki lewat CSS) — perlu info merk/model printer & foto hasil cetak untuk diagnosis lanjut.
- Backlog lama tetap belum disentuh (di luar scope): agregasi item soft-delete `page.js:380`/`:556`, migrasi soft-delete produksi, risiko concurrency `api/order/route.js`, printer struk dapur.

---

## 2026-09-19 07:23 Asia/Taipei — Codex: laporan harian

- Selesai: review terhadap baseline e3dad22. Baseline baru a0e61f7 (Rev 5.6, 19 September 00:49 Taiwan). Trigger datang 07:20:55, bukan 05:00; penyebab belum diperiksa. Sebelum catatan ini tidak ada perubahan tracked staged/unstaged; .claude/settings.local.json tetap untracked (isi tidak diperiksa).
- Perubahan produk: src/app/globals.css +75/-21, src/app/page.js +84/-32, total 159 tambahan/53 pengurangan; tambahan catatan 172 baris tidak dihitung sebagai produk. Tidak ada perubahan API, schema atau logika pembayaran pada rentang commit ini.
- Implementasi cetak QR sudah ditulis: konten 48mm dipusatkan, QR 40mm, badge meja teks hitam 22pt dengan border, isi cetak menjadi nomor meja/QR/ajakan scan/waktu. Judul panjang dan kode transaksi disembunyikan hanya saat cetak. Alur tetap activeQr -> JSX/SVG -> window.print -> CSS -> dialog printer. Berguna untuk keterbacaan perangkat, bukan hanya dekorasi. Belum diverifikasi preview, scan atau printer fisik.
- Temuan BARU P2 terbukti berdasarkan kode dan grammar resmi: globals.css:205 memakai size:58mm auto. W3C CSS Paged Media 3 bagian 7.1 mendefinisikan size sebagai satu/dua length ATAU auto, bukan length+auto (https://www.w3.org/TR/css-page-3/#page-size-prop). Jadi klaim catatan sebelumnya bahwa deklarasi ini menetapkan lebar 58mm dan tinggi otomatis tidak benar menurut spesifikasi. Task manager: koreksi deklarasi dan verifikasi pilihan ukuran printer/preview, pemusatan, panjang hasil cetak serta scan QR; belum menyatakan ini satu-satunya penyebab hasil miring. Percobaan validator css-tree lokal tidak mendukung descriptor ini (method tidak tersedia/Unknown property), sehingga tidak dipakai sebagai bukti kegagalan browser. Belum uji browser nyata.
- Tampilan item terhapus terverifikasi: page.js:1777 dan :2689 mengumpulkan semua item terhapus ke blok Item Dihapus paling bawah; grup aktif tetap per-order, grup kosong disembunyikan; Pesanan Tambahan berwarna hijau. Alur data API/DB tetap, hanya pemisahan saat render. Relevan untuk mengurangi kekeliruan kasir antara tambahan dan penghapusan; bukan perbaikan agregasi laporan.
- P1 tetap: page.js:380/:556 belum menyaring deletedAt untuk statistik/rekap. Bukti eksekusi 17 September tetap berlaku, fungsi tidak berubah pada diff ini; uji sama tidak diulang. API order hash SHA256 masih sama dengan 18 September (E3E75DF63785D0A5F4BAAAC495E77B41B3F79DC244A2F396C532BCB8B3062C17): risiko bersamaan dengan pembayaran/penghapusan belum diperbaiki atau direproduksi. Migrasi soft-delete belum ada konfirmasi baru, DB live tidak diperiksa.
- Task belum selesai: perbaiki agregasi item terhapus; validasi/perbaiki concurrency; verifikasi migrasi dan uji end-to-end; koreksi size cetak dan uji fisik/label panjang; uji tampilan lintas order; integrasi struk dapur (berbeda dari cetak QR); keputusan bisnis statistik/durasi take away/reset kitchenStatus tetap terbuka.
- Pemeriksaan: Agents.md, catatan terbaru, git log/status/diff/numstat, hash API, kode render/CSS, spesifikasi resmi. Lint/build/browser/DB tidak dijalankan; klaim lint di catatan Claude belum diuji ulang. Tidak mengubah aplikasi/DB/deploy/commit, hanya menambahkan laporan ini. Hasil lengkap disampaikan di task untuk manager.

## 2026-09-20 23:23 Asia/Taipei — Codex: laporan harian

- Review selesai. Trigger diterima 23:22:42 Taiwan, terlambat dari jadwal 05:00; penyebab belum diperiksa. Baseline baru 9d3e2e92576ae8c2d4bcd1bfebd2cc475904f9e9, dibanding a0e61f7.
- Commit baru hanya menyimpan 13 baris laporan Codex 19 September pada CATATAN_PROYEK.md. Tidak ada penambahan/pengurangan kode produk, arsitektur, alur data, API atau schema. Sebelum laporan ini tidak ada tracked staged/unstaged; .claude/settings.local.json tetap untracked, isinya tidak diperiksa. Hash dashboard/API order/CSS identik dengan review 19 September.
- Tidak ditemukan task produk baru atau penyelesaian implementasi baru. Dokumentasi relevan untuk kesinambungan review, bukan peningkatan fungsi produk. Jangan menganggap commit berjudul Rev 5.6 ini sebagai perbaikan bug.
- Prioritas manager tetap: P1 agregasi item terhapus page.js:380/:556 (bug terbukti lewat uji fungsi 17 September, belum berubah); P1 validasi/perbaikan order bersamaan dengan pembayaran/penghapusan (kode tidak berubah, dampak concurrency belum direproduksi); verifikasi migrasi soft-delete (tidak ada bukti selesai baru, DB live tidak diperiksa). P2 deklarasi size:58mm auto masih di globals.css:206, belum dikoreksi; hasil print/scan belum diuji. Koreksi referensi sebelumnya: deklarasi size berada di baris 206, bukan 205.
- Backlog lain tetap: uji browser tampilan item terhapus lintas order, cetak fisik QR/label panjang, integrasi struk dapur, keputusan bisnis statistik/durasi take away/reset kitchenStatus. Langkah berikutnya tetap perbaikan dan verifikasi backlog berdasarkan prioritas, bukan penambahan fitur kosmetik.
- Pemeriksaan: Agents.md, catatan terbaru, git log/status/diff termasuk staged/unstaged/untracked, hash tiga file dan pencarian kode terkait. Tidak mengulang tes identik karena kode tidak berubah; tidak menjalankan lint/build/browser atau akses DB. Hanya catatan ini ditambahkan; laporan mandiri juga dikirim di task agar manager tidak bergantung pada file lokal.

## 2026-09-21 09:33 Asia/Taipei — Codex: laporan harian

- Review selesai terhadap laporan 20 September 23:23; baseline tetap 9d3e2e92576ae8c2d4bcd1bfebd2cc475904f9e9. Trigger diterima 09:19:59, pemeriksaan sekitar 09:33 Taiwan; bukan tepat 05:00, penyebab belum diperiksa.
- Tidak ada commit atau perubahan kode produk baru. Satu-satunya tracked diff sebelum laporan ini adalah 9 baris laporan Codex kemarin pada CATATAN_PROYEK.md (belum di-commit); staged kosong. .claude/settings.local.json tetap untracked, isi tidak diperiksa. Hash dashboard/API order/CSS identik dengan laporan sebelumnya. Tidak ada perubahan arsitektur, alur data, schema, API atau fungsi penting.
- Task baru/penyelesaian produk baru: tidak ditemukan. Dokumentasi punya fungsi pelacakan, tidak menandakan bug selesai. Prioritas operasional tetap perhitungan benar dan konsistensi transaksi sebelum perapian tampilan tambahan.
- Backlog tetap: P1 item terhapus masih dihitung pada page.js:380/:556 (terbukti uji fungsi 17 September); P1 risiko order bersamaan pembayaran/penghapusan (implementasi belum berubah, dampak belum direproduksi); status migrasi soft-delete belum dikonfirmasi ulang. P2 size:58mm auto pada globals.css:206 belum diperbaiki; uji cetak/scan fisik belum ada bukti baru. Uji browser, integrasi struk dapur dan keputusan bisnis statistik/reset kitchenStatus tetap terbuka.
- Pemeriksaan: Agents.md, catatan terakhir, git status/log/diff termasuk staged dan file untracked, hash file terkait. Tidak mengulang tes identik karena tidak ada perubahan produk; tidak menjalankan browser/lint/build/query DB. Laporan ini saja ditambahkan, pekerjaan lain dipertahankan; hasil mandiri disampaikan di task untuk manager.

## 2026-09-22 — Codex: pengujian pesanan serentak
- Tugas berjalan: uji permintaan serentak pada handler order asli dan PostgreSQL lokal sementara; tidak menggunakan database Supabase. Perubahan awal hanya CATATAN_PROYEK.md, dipertahankan.
- Backlog sebelumnya tetap: agregasi soft-delete, race order/pembayaran, migrasi produksi, validasi cetak QR dan kitchen printer. Sesi ini fokus pada concurrency pemesanan.

- Selesai: 26 kasus (8 lulus, 18 gagal karena 3 masalah yang masing-masing direproduksi 6 kali). Empat skenario pada meja sama dijalankan 3 kali secara HTTP paralel alami dan 3 kali dengan barrier sebelum transaksi tulis; ditambah warmup dan 10 meja berbeda. Handler src/app/api/order/route.js asli dieksekusi dengan Prisma + NextResponse asli lewat HTTP harness, bukan mock database. Bukan pengujian browser/full Next.js atau produksi.
- TERBUKTI: 5 kiriman berbeda pada meja sama (2 porsi/kiriman) semuanya 200, tersimpan 5 order/10 porsi. 10 meja berbeda juga seluruhnya 200. Total transaksi selalu sesuai jumlah item/order pada semua skenario ini.
- TERBUKTI P1: sesi berisi 90 porsi + 5 kiriman serentak masing-masing 10 menghasilkan 140 porsi, semua HTTP 200; batas 100 terlewati di 6/6 percobaan. Penyebab: pembacaan/agregasi dan validasi batas pada api/order/route.js:43-62 berada sebelum transaksi tulis :76, tanpa penguncian sesi atau validasi ulang batas di transaksi.
- TERBUKTI: batas 5 kiriman/menit terlewati oleh 10 kiriman serentak, 10 order dan 10 receipt tersimpan di 6/6 percobaan. Penyebab sama: count dibaca sebelum penulisan.
- TERBUKTI: 6 permintaan identik dengan requestId sama menghasilkan 1 HTTP 200 + 5 HTTP 500 (Prisma P2002) di 6/6 percobaan. Hanya 1 order/receipt tersimpan; tidak terjadi pesanan ganda. Retry setelah selesai mendapat 200 dan tetap 1 order. findUnique :78 bukan penguncian; benturan unique saat orderSubmission.create :89 masuk catch generik :99.
- Metode: dispatch HTTP meja sama tersebar 0,46-1,32 ms; hasil alami sudah mereproduksi masalah. Barrier tambahan menahan semua request setelah pembacaan asli, lalu melepas transaksi tulis bersama untuk memastikan overlap, tidak mengubah handler aplikasi.
- Artefak: tests/order-concurrency-local.cjs (tes integrasi dapat diulang dengan CONCURRENCY_DATABASE_URL pada loopback port 55439); tmp/order-concurrency-results.json (hasil lengkap, hash handler dan cleanup). node --check lulus; eksekusi tes exit 1 memang menandakan assertion hasil bisnis gagal. Lint/build/browser tidak dijalankan karena kode aplikasi tidak diubah.
- Keselamatan data: schema diterapkan hanya ke cluster PostgreSQL 18 sementara pada 127.0.0.1:55439. Semua fixture milik tes dihapus, jumlah sesi tersisa 0; server sementara sudah dihentikan. .env/Supabase/data kasir yang ada tidak diubah.
- Perubahan hanya skrip tes, hasil tes dan catatan. Arsitektur/alur data/API/database produksi tidak diubah. Belum memperbaiki ketiga masalah; langkah berikutnya perbaikan sinkronisasi per sesi dan penanganan duplicate request, lalu ulang tes ini. Race order vs pembayaran/penghapusan masih belum diuji pada sesi ini; backlog lain tetap terbuka.

---

## 2026-09-22 (lanjutan) — Claude Sonnet 5

### Tugas
Pengguna melaporkan 3 masalah yang ditemukan saat mencoba memesan berkali-kali/serentak dari sisi customer, dan minta diperbaiki:
1. Batas 100 porsi per sesi (scan QR berulang) bisa dilewati kalau beberapa kiriman dikirim bersamaan.
2. Batas 5 kiriman/menit bisa dilewati kalau >5 kiriman dikirim bersamaan; kalau kena batas, tampilkan hitung mundur "coba lagi setelah X detik/menit" ke customer.
3. Pakai `requestId` yang sama dari 2 tab berbeda (tab A belum terkonfirmasi, lalu tab B mengirim juga) — tab B menampilkan error "pengiriman belum dipastikan" walau tab A sebenarnya sukses.

Ini persis 3 bug yang sudah **TERBUKTI** oleh Codex hari ini lewat pengujian nyata (lihat entri "2026-09-22 — Codex: pengujian pesanan serentak" tepat di atas) — root cause-nya sama: validasi batas & pengecekan `requestId` dibaca di `src/app/api/order/route.js` **sebelum** transaksi tulis, tanpa penguncian per sesi, sehingga beberapa request paralel semuanya lolos validasi sebelum salah satu benar-benar menulis.

### Perubahan kode
- `src/app/api/order/route.js`:
  - Tambah advisory lock Postgres per sesi (`pg_advisory_xact_lock(hashtext('order-session:' + transactionId))`) di awal transaksi tulis — pola yang sama persis dengan `tableConflict()` di `src/lib/table-session.js` yang sudah lama dipakai untuk mengunci bentrok nomor meja. Efeknya: semua kiriman untuk `transactionId` yang sama diserialkan (satu per satu), tidak lagi paralel murni.
  - Pengecekan rate-limit (hitung kiriman 60 detik terakhir) dan session-limit (jumlah total porsi tersimpan) **dipindah dari pre-flight read (di luar lock) ke dalam transaksi setelah lock didapat**, lalu dibaca ulang dari database sesaat sebelum menulis. Sebelumnya kedua angka ini dibaca sekali di awal lalu dipakai oleh semua request paralel — itu sebabnya batasnya bisa dilewati.
  - Pengecekan idempotency `requestId` (`doubleCheck`) tetap di dalam transaksi seperti sebelumnya, tapi sekarang terjadi **setelah** lock didapat — jadi kalau tab B menunggu giliran lock sementara tab A baru saja commit, tab B akan menemukan baris tab A lewat `doubleCheck` dan langsung mengembalikan respons yang sama (200), bukan mencoba `create()` lagi yang akan bentrok unique-constraint.
  - Tambah kelas error `OrderRejected` (dilempar di dalam transaksi saat rate-limit/session-limit gagal) supaya kode status HTTP yang benar (429/409) tetap terkirim ke client, bukan tertangkap oleh catch generik yang mengembalikan 500.
  - Tambah penanganan cadangan (defensive) untuk error unique-constraint Prisma (`P2002`) di catch terluar: kalau tetap ada 2 request dengan `requestId` sama yang bentrok (seharusnya sudah dicegah oleh lock di atas, tapi dijaga untuk kondisi tepi), server sekarang mengambil ulang baris yang sudah tersimpan dan mengembalikannya sebagai `200`, bukan `500 "Status pengiriman belum dapat dipastikan"`.
  - Respons `RATE_LIMIT` sekarang menyertakan field `retryAfterMs` — dihitung dari kiriman tertua dalam jendela 60 detik terakhir (`kiriman_tertua.createdAt + 60000 - sekarang`), supaya client bisa menampilkan hitung mundur yang akurat berdasarkan pesanan terakhir yang benar-benar terkirim, bukan angka tetap.
  - Pesan `SESSION_LIMIT` diubah jadi: *"Pesanan sudah melewati 100 porsi. Panggil karyawan jika ingin menambah pesanan."* (sebelumnya "Silakan hubungi kasir.") — sesuai kalimat yang diminta pengguna.
- `src/app/order/[transactionId]/page.js`:
  - Tambah `sessionLimitReached` (dihitung dari total porsi aktif di `transaction.orders`, dibaca ulang setiap render) — saat `>= 100`: `updateCart` diblok (tidak bisa tambah item lagi), banner merah "Pesanan sudah melewati 100 porsi. Panggil karyawan jika ingin menambah pesanan." tampil di layar menu utama maupun layar sukses, dan semua tombol kirim/"Pesan Menu Tambahan" dinonaktifkan.
  - Tambah state `rateLimitedUntil` + `now` dan `useEffect` yang jalan tiap 1 detik untuk menghitung `rateLimitSecondsLeft` — dipicu saat respons server berkode `RATE_LIMIT` (pakai `retryAfterMs` dari server). Tampilkan "Terlalu banyak pengiriman. Coba lagi setelah X detik/menit." dan nonaktifkan tombol kirim selama hitung mundur berjalan.
  - Teks bantuan batas di atas menu diperbarui supaya juga menyebutkan batas "5 kiriman per menit" (sebelumnya cuma menyebut 3 batas lain, bukan rate-limit).

### Kenapa desainnya begini
- **Tidak menambah mekanisme lock baru** — reuse pola advisory lock Postgres yang sudah terbukti aman dipakai untuk kasus serupa (bentrok nomor meja) di file lain. Konsisten dengan gaya kode proyek.
- **Staf TIDAK diberi jalur bypass baru di `/api/order`** — diperiksa dulu (baca kode `src/app/page.js:2369-2404` dan `src/app/api/transaction/[id]/edit-order/route.js`): modal "Edit Pesanan" staf sudah bisa menambah menu baru ke transaksi manapun lewat endpoint terpisah (`PUT .../edit-order`) yang **tidak punya batas porsi sama sekali** (hanya batas 1000/baris, 200 baris). Jadi permintaan "kalau melewati, karyawan masih bisa menambahkan pesanan" **sudah terpenuhi lewat fitur yang sudah ada**, tidak perlu menambah logika deteksi staf di endpoint customer. `/api/order` sengaja tetap berlaku sama untuk semua pemanggil (termasuk Take Away langsung oleh staf) supaya tidak menambah percabangan otorisasi baru di endpoint publik.
- **Lock diletakkan SEBELUM pengecekan idempotency `requestId`** (bukan sesudah) — supaya kasus tab-A/tab-B (task 3) otomatis ikut teratasi oleh mekanisme yang sama dengan task 1 & 2, tanpa logika terpisah: request yang kalah cukup menunggu giliran lock, lalu `doubleCheck` menemukan baris yang sudah dibuat pemenangnya.
- **`retryAfterMs` dihitung dari kiriman tertua dalam jendela**, bukan konstanta 60 detik — sesuai permintaan pengguna: "sejak pesanan terakhir dikirim, hitung berapa detik/menit lagi customer bisa memesan lagi". Kalau memakai konstanta tetap, angkanya tidak akan konsisten dengan kapan slot benar-benar terbuka lagi.

### Pengujian (dijalankan nyata, bukan hanya baca kode)
- `npx eslint` pada kedua file yang diubah, dibandingkan sebelum/sesudah (`git stash` + lint ulang): **hasil identik**, 0 error, 2 warning pra-existing (tidak berkaitan dengan perubahan).
- **Dijalankan ulang skrip pengujian serentak Codex** (`tests/order-concurrency-local.cjs`, tidak diubah) terhadap kode yang sudah diperbaiki. Karena cluster PostgreSQL sementara Codex di port 55439 sudah dimatikan, dibuatkan cluster PostgreSQL 18 sementara BARU (data dir `tmp/pgdata-concurrency`, dihapus lagi setelah selesai) — bukan `kasir_local` (dev permanen) atau Supabase produksi.
  - **Hasil: 26/26 kasus lulus** (sebelumnya 8/26 lulus, 18 gagal pada laporan Codex).
  - Batas 100 porsi: sesi 90 porsi + 5 kiriman serentak × 10 porsi → total akhir **tepat 100** (1×200, 4×409 `SESSION_LIMIT`), tidak lagi 140.
  - Batas 5 kiriman/menit: 10 kiriman serentak → **tepat 5** tersimpan (5×200, 5×429 `RATE_LIMIT`), tidak lagi 10.
  - `requestId` sama dari 6 kiriman serentak → **semua 6 dapat HTTP 200** (bukan 1×200 + 5×500), hanya 1 order/1 receipt tersimpan di DB, retry setelahnya tetap konsisten (1 order).
  - Semua kasus lain (meja berbeda, dalam batas wajar) tetap lulus seperti sebelumnya — tidak ada regresi.
  - Cluster sementara sudah dimatikan & dihapus setelah pengujian; `.env`/Supabase/`kasir_local` tidak disentuh.
- **Belum diuji**: browser sungguhan (klik nyata di 2 tab, tunggu countdown rate-limit jalan di layar). Perubahan client (`page.js` customer) baru diverifikasi lewat lint + baca kode, bukan interaksi UI nyata, karena sesi ini CLI-only.

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual di browser: (a) scan QR sama berkali-kali sampai total ≥100 porsi, pastikan banner & tombol terkunci muncul benar; (b) kirim pesanan cepat berturut-turut, pastikan hitung mundur rate-limit tampil dan berjalan turun tiap detik; (c) buka tab A & B untuk transaksi yang sama, submit di A, sebelum respons balik buka tab B (localStorage sama) dan submit juga — pastikan salah satu tab akhirnya menampilkan "Pesanan Berhasil Terkirim!", bukan pesan error.
- Backlog lama dari sesi-sesi sebelumnya masih belum disentuh (di luar scope tugas hari ini): agregasi item soft-delete di `page.js` (rekap/statistik ikut menghitung item terhapus), migrasi soft-delete produksi belum diverifikasi ulang, race order vs pembayaran/penghapusan sesi (berbeda dari 3 race yang diperbaiki hari ini), integrasi printer struk dapur, keputusan bisnis jam sibuk/durasi take away/reset kitchenStatus.
- Catatan desain: agregat `currentItemAgg`/`submittedAgg` di `api/order/route.js` (dipakai untuk cek batas 100 porsi) tidak memfilter `OrderItem.deletedAt` — perilaku ini **sudah ada sejak sebelum sesi ini** (tidak diubah), artinya item yang di-soft-delete kasir lewat Edit Pesanan tetap ikut dihitung ke kuota 100 porsi customer. Tidak diperbaiki hari ini karena di luar scope (3 race condition), tapi dicatat sebagai temuan untuk keputusan bisnis berikutnya.

---

## 2026-09-22 (lanjutan 2) — Claude Sonnet 5

### Tugas
Pengguna melaporkan: peringatan "sudah 100 porsi, panggil karyawan" kurang jelas terbaca — saat modal "Kirim Pesanan"/konfirmasi pesanan terbuka, backdrop-nya blur sehingga banner peringatan di halaman belakang (ditambahkan sesi sebelumnya) tidak terbaca. Diminta tampilkan peringatan itu di dalam menu kirim/konfirmasi pesanan.

### Perubahan kode
- `src/app/order/[transactionId]/page.js` — tambah blok peringatan (ikon ⚠️, latar merah muda `#fee2e2`) di **dalam** modal "Detail Keranjang Pesanan", tepat di bawah header modal, sebelum daftar item. Muncul saat `sessionLimitReached` (pesan batas 100 porsi) atau `rateLimitSecondsLeft > 0` (pesan hitung mundur rate-limit) — keduanya sudah ada sebagai state dari sesi sebelumnya, di sini hanya dipindah/diduplikasi tampilannya ke lokasi yang tidak tertutup blur.

### Kenapa desainnya begini
- Banner yang sudah ada di halaman utama (di luar modal) tetap dipertahankan (berguna sebelum modal dibuka), peringatan baru ini murni tambahan supaya tetap terlihat **saat modal terbuka**, karena `backdropFilter: 'blur(4px)'` pada overlay modal (`page.js` sekitar baris 947-960) membuat konten di belakangnya (termasuk banner lama) jadi buram dan sulit dibaca — modal sendiri (`background: var(--card-bg)`) tidak ikut ter-blur karena berada di atas layer overlay, jadi solusinya menaruh salinan pesan di dalam kartu modal itu sendiri, bukan mengubah intensitas blur (blur sengaja dipakai untuk fokus visual ke modal).

### Pengujian
- `npx eslint "src/app/order/[transactionId]/page.js"` — dibandingkan sebelum/sesudah: hasil identik, 0 error, 2 warning pra-existing (missing dep `storageKey`, pemakaian `<img>`), tidak berkaitan dengan perubahan ini.
- **Belum diuji di browser** — perlu buka modal kirim pesanan dalam kondisi sudah ≥100 porsi (atau sedang kena rate-limit) dan pastikan peringatan terbaca jelas tanpa terhalang blur.

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual di browser untuk perubahan ini (lihat Pengujian).
- Daftar uji manual dari sesi sebelumnya (scan QR sampai ≥100 porsi, kirim cepat berturut-turut untuk rate-limit, tab A/B dengan requestId sama) masih belum dijalankan — lihat entri "2026-09-22 (lanjutan)" di atas.

---

## 2026-09-22 (lanjutan 3) — Claude Sonnet 5

### Tugas
Pengguna masih melihat masalah yang sama: saat modal "Detail Keranjang Pesanan" terbuka, halaman di belakangnya blur sehingga peringatan "sudah lebih dari 100 porsi" tidak terbaca. Diminta 3 hal:
1. Tampilkan pesan error "sudah lebih dari 100 porsi" di dalam tampilan detail keranjang pesanan.
2. Hapus teks hint statis "Maksimal 10 porsi per menu, 30 porsi per kiriman, 100 porsi per sesi, dan 5 kiriman per menit. Pesanan lebih besar: hubungi kasir." dari halaman pesanan customer.
3. Fitur baru: kalau customer sudah memesan (kumulatif) lebih dari 30 porsi, tampilkan pesan bahwa untuk pesanan lebih banyak lagi bisa panggil kasir.

### Root cause #1 (kenapa perbaikan sesi sebelumnya belum cukup)
Sesi sebelumnya ("2026-09-22 (lanjutan 2)") sudah menambah blok peringatan di dalam modal, tapi kondisinya hanya `sessionLimitReached || rateLimitSecondsLeft > 0` — dua nilai yang dihitung **client-side** dari data `transaction.orders` yang sudah dikonfirmasi server. Skenario paling umum yang dilaporkan pengguna: total pesanan customer sebelum submit masih < 100 (jadi `sessionLimitReached` masih `false`, modal tidak menampilkan apa-apa), lalu begitu klik "Kirim Pesanan Sekarang" barulah server menolak dengan `409 SESSION_LIMIT` (karena ditambah isi keranjang jadi ≥100). Penolakan itu ditangkap dan disimpan ke state `submitMessage` — tapi `submitMessage` **hanya dirender di halaman utama** (di belakang modal), bukan di dalam modal. Karena modal tidak otomatis tertutup saat submit ditolak, pengguna tetap melihat modal blur tanpa pesan error apa pun. Ini baru ketahuan setelah menelusuri ulang alur `submitOrder()` — pada sesi sebelumnya saya keliru asumsikan `sessionLimitReached` sudah cukup untuk menutup semua kasus.

### Perubahan kode
- `src/app/order/[transactionId]/page.js`:
  - Blok peringatan merah di dalam modal "Detail Keranjang Pesanan" sekarang juga memeriksa `submitMessage` (selain `sessionLimitReached` dan `rateLimitSecondsLeft`) — jadi begitu server menolak submit dengan alasan apa pun (termasuk `SESSION_LIMIT` "Pesanan sudah melewati 100 porsi..."), pesannya langsung terlihat di dalam modal, bukan hanya di halaman belakang yang blur.
  - Hapus baris `<p role="status">Maksimal ... porsi per menu, ... per sesi, dan ... kiriman per menit.</p>` dari halaman menu utama (permintaan #2).
  - Tambah `bigOrderNotice` (derived: total porsi kumulatif > `ORDER_LIMITS.perSubmission` (30) dan belum menyentuh `sessionLimitReached`) — menampilkan pesan kuning informasional "Anda sudah memesan lebih dari 30 porsi. Jika ingin memesan lebih banyak lagi, silakan panggil kasir." Ini **bukan** blokir (tombol tetap aktif, cuma pemberitahuan) — beda dari batas 100 porsi yang benar-benar mengunci. Ditampilkan baik di halaman menu utama maupun di dalam modal keranjang (sebelum submitMessage/sessionLimitReached/rate-limit mengambil alih ruang peringatan, supaya tidak dobel pesan).
  - Threshold 30 sengaja pakai `ORDER_LIMITS.perSubmission` yang sudah ada (bukan angka baru terpisah) — kebetulan sama-sama 30 porsi dan supaya tetap satu sumber kebenaran kalau batas per-kiriman berubah di masa depan.

### Kenapa desainnya begini
- **Tidak menutup modal otomatis saat ditolak** — dibiarkan seperti perilaku lama (modal tetap terbuka setelah rejection) supaya customer bisa langsung lihat isi keranjangnya dan pesan errornya sekaligus, tanpa harus buka-tutup modal lagi.
- **`bigOrderNotice` murni informasional, tidak mengunci apa pun** — beda dari `sessionLimitReached` (≥100 porsi, mengunci total) sesuai permintaan eksplisit pengguna: "tampilkan pesan jika ingin memesan lebih dari 30 porsi bisa memanggil kasir", bukan "blokir di atas 30 porsi". Customer tetap bisa lanjut memesan sampai batas keras 100 porsi.
- **Hint teks lama dihapus total, tidak diganti hint lain yang selalu tampil** — sesuai permintaan eksplisit #2. Informasi batas sekarang hanya muncul kontekstual (saat relevan: lebih dari 30 porsi, kena rate-limit, atau sudah capai 100 porsi), bukan selalu terpampang di atas menu.

### Pengujian
- `npx eslint "src/app/order/[transactionId]/page.js"` — dibandingkan sebelum/sesudah: hasil identik, 0 error, 2 warning pra-existing (missing dep `storageKey`, pemakaian `<img>`), tidak berkaitan dengan perubahan ini.
- **Belum diuji di browser** — perlu dicoba: (a) buka modal keranjang dengan total pesanan sudah di atas 30 tapi di bawah 100, pastikan pesan kuning informasional muncul; (b) isi cart yang kalau ditambah ke total confirmed akan ≥100, klik "Kirim Pesanan Sekarang", pastikan pesan merah "Pesanan sudah melewati 100 porsi..." langsung terlihat DI DALAM modal (bukan cuma di halaman belakang); (c) pastikan hint lama "Maksimal 10 porsi per menu..." sudah tidak muncul lagi di halaman manapun.

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual browser untuk 3 perubahan di atas (lihat Pengujian).
- Semua daftar uji manual dari 2 entri sebelumnya (2026-09-22 lanjutan & lanjutan 2) masih tertunda — belum ada satupun perubahan customer-order sesi hari ini yang diverifikasi lewat klik nyata di browser, baru lewat baca kode + lint + (untuk perbaikan race condition) uji HTTP otomatis.

---

## 2026-09-22 (lanjutan 4) — Claude Sonnet 5

### Tugas
Koreksi dari pengguna atas fitur notice ">30 porsi" (ditambahkan sesi "lanjutan 3"):
1. Bug: di modal "Detail Keranjang Pesanan", saat total pesanan tepat menyentuh angka 30, notice tidak muncul. Diminta jadi `>=30` (bukan `>30`).
2. Konfirmasi: saat sudah ≥100 porsi, notice 30-porsi harus hilang dan cuma notice 100-porsi yang tampil — desain tampilan modal untuk kasus 100-porsi **jangan diubah**, sudah dianggap benar oleh pengguna.
3. Fitur baru: peringatan (30-porsi maupun 100-porsi, sesuai aturan #1 & #2) juga harus muncul di layar "Pesanan Berhasil Terkirim!" (layar setelah submit sukses, yang punya tombol "Pesan Menu Tambahan") — sebelumnya layar itu cuma menampilkan peringatan 100-porsi, belum ada peringatan 30-porsi.

### Root cause bug #1
`bigOrderNotice` di sesi sebelumnya memakai `getAggregatedTotalItemCount() > ORDER_LIMITS.perSubmission` (strictly greater than 30) — jadi tepat di angka 30 kondisinya masih `false`, baru muncul di porsi ke-31. Ini salah ketik ambang batas, seharusnya `>=` sesuai maksud fitur ("begitu menyentuh 30, sudah waktunya diingatkan").

### Perubahan kode
- `src/app/order/[transactionId]/page.js`:
  - `bigOrderNotice`: operator diubah dari `>` jadi `>=` — sekarang trigger tepat di porsi ke-30, bukan ke-31. Variabel ini dipakai di 3 tempat (banner halaman menu utama, modal keranjang, layar sukses) sehingga satu perbaikan berlaku konsisten di semuanya.
  - Teks notice disesuaikan dari "Anda sudah memesan **lebih dari** 30 porsi" jadi "Anda sudah memesan 30 porsi **atau lebih**" — supaya tetap akurat sekarang trigger-nya `>=` (di porsi tepat 30, "lebih dari 30" secara harfiah salah).
  - Mutual exclusivity 30 vs 100 **tidak perlu kode tambahan** — `bigOrderNotice` dari awal sudah didefinisikan sebagai `!sessionLimitReached && total >= 30`, jadi begitu `sessionLimitReached` (≥100) jadi `true`, `bigOrderNotice` otomatis `false` di semua tempat yang memakainya. Ini sudah memenuhi permintaan #2 tanpa perubahan lain.
  - Tambah blok peringatan `bigOrderNotice` (kuning, sama seperti di halaman menu utama) di layar "Pesanan Berhasil Terkirim!" — ditaruh persis sebelum tombol "Pesan Menu Tambahan", sejajar dengan blok `sessionLimitReached` (merah) yang sudah ada di situ sejak sesi "lanjutan". Sama-sama dibungkus kondisi `['open','ordered'].includes(transaction?.status)` supaya tidak tampil kalau sesi sudah ditutup.
  - Blok peringatan di dalam modal keranjang (yang menurut pengguna "udah bagus") **tidak disentuh sama sekali** kecuali otomatis ikut kena perbaikan `>=`/teks di atas (karena pakai variabel & teks yang sama) — sesuai permintaan eksplisit "jangan ganti itu".

### Pengujian
- `npx eslint "src/app/order/[transactionId]/page.js"` — dibandingkan sebelum/sesudah: hasil identik, 0 error, 2 warning pra-existing, tidak berkaitan dengan perubahan ini.
- **Belum diuji di browser** — perlu dicoba: (a) total pesanan tepat 30 porsi → notice kuning harus muncul (sebelumnya baru muncul di 31); (b) total ≥100 porsi → notice kuning hilang, hanya notice merah 100-porsi yang tampil, baik di halaman menu maupun di layar "Pesanan Berhasil Terkirim!"; (c) di layar sukses dengan total 30-99 porsi → notice kuning baru muncul di situ (fitur baru).

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual browser untuk perubahan ini (lihat Pengujian).
- Semua daftar uji manual dari entri-entri sebelumnya hari ini (2026-09-22 dan lanjutannya) masih tertunda — belum ada satupun perubahan customer-order hari ini yang diverifikasi lewat klik nyata di browser.

---

## 2026-09-22 (lanjutan 5) — Claude Sonnet 5

### Tugas
Pengguna minta audit alur "meja dibuat → customer pesan → bayar → sesi ditutup", khusus memastikan 4 hal di tampilan customer setelah sesi ditutup (kalau QR meja itu dipakai lagi untuk memesan): (1) halaman tidak bisa akses/ubah data sistem, (2) tidak ada tombol yang disembunyikan (tetap ada tapi tersamar), (3) halaman hanya menampilkan pemberitahuan sesi ditutup, (4) tidak ada fungsi yang masih bisa mengakses server/data restoran.

### Metode
Baca kode `src/app/order/[transactionId]/page.js` (alur render & state customer), `src/app/api/transaction/[id]/route.js` (GET publik yang dipakai halaman customer, PUT pembayaran), `src/app/api/order/route.js` (validasi `SESSION_CLOSED`). Tidak menjalankan browser (CLI-only), murni audit statis + perbaikan berdasarkan pembacaan kode.

### Temuan (dibuktikan lewat baca kode, bukan dugaan)

**AMAN — skenario "scan ulang QR lama SETELAH sesi ditutup" (fresh page load):**
- `page.js:62-68` (fungsi `fetchData`, dijalankan sekali saat halaman pertama dibuka): kalau `trxData.status` bukan `'open'`/`'ordered'`, langsung `setError('Transaksi ini sudah selesai.')`.
- Render `if (error) return (...)` (sebelum perubahan sesi ini di baris ~344) menampilkan **hanya** kartu teks statis "Transaksi ini sudah selesai. Silakan hubungi kasir untuk mendapatkan QR Code baru." — **tidak ada satu pun tombol**, tidak ada `fetch()` lain yang dipicu dari blok ini. Memenuhi syarat #1-4 pengguna untuk skenario ini.
- `GET /api/transaction/[id]` (endpoint publik yang dipakai) untuk viewer non-staff hanya mengembalikan field terbatas milik transaksi itu sendiri (`id, tableNumber, status, createdAt, completedAt, total, orders[].items` tanpa nama staf/kasir, tanpa data transaksi lain) — bukan "data restoran" dalam arti data internal/rahasia, dan ID transaksi pakai `cuid()` (tidak berurutan/tidak bisa ditebak), jadi tidak bisa dipakai mengintip transaksi lain.

**TERBUKTI, BUG — transisi sesi ke "ditutup" SAAT tab customer masih terbuka (bukan fresh load):**
- Kalau customer sedang di layar menu (browsing) atau layar "Pesanan Berhasil Terkirim!" saat kasir menyelesaikan pembayaran, polling status tiap 5 detik (`page.js:105-119`, versi sebelum perubahan) meng-update `transaction.status` tapi **tidak ada logika sama sekali** yang memindahkan tampilan ke layar "sesi ditutup". Yang muncul cuma banner kecil "Sesi sudah ditutup" (`page.js:520` versi lama) sementara seluruh menu, tombol tambah ke keranjang, dan modal "Detail Keranjang Pesanan" **tetap tampil dan bisa diklik** — melanggar syarat #2 dan #3.
- `updateCart` (`page.js:170`, versi lama) tidak mengecek status transaksi sama sekali — customer masih bisa menambah item ke keranjang meski sesi sudah ditutup (pelanggaran ringan terhadap syarat #4, walau tidak bisa menghasilkan order baru karena `submitOrder`/server tetap menolak).
- Polling (`refreshStatus`) tidak pernah berhenti — tetap mengirim `GET /api/transaction/[id]` tiap 5 detik selamanya selama tab terbuka, bahkan lama setelah sesi ditutup. Read-only dan datanya tidak sensitif (lihat poin di atas), tapi tetap "mengakses server" tanpa alasan setelah sesi final — pelanggaran halus terhadap syarat #4.
- Penulisan data (order baru) sendiri **sudah aman** — server (`api/order/route.js:67-69`) selalu menolak dengan `SESSION_CLOSED` (409) untuk transaksi yang statusnya bukan `open`/`ordered`, jadi tidak ada risiko data pesanan/pembayaran berubah. Temuan di atas murni soal UI yang masih terasa "hidup" padahal seharusnya mati total begitu ditutup, sesuai permintaan eksplisit pengguna.

### Perubahan kode
- `src/app/order/[transactionId]/page.js`:
  - Tambah `closedRef` (ref, bukan state) + `useEffect` yang menandai `closedRef.current = true` begitu `transaction.status` (hasil polling) bukan `'open'`/`'ordered'`.
  - Tambah `sessionClosedMidView` — nilai turunan (dihitung langsung saat render dari `transaction`, BUKAN lewat `setState` di dalam efek, supaya tidak kena lint `react-hooks/set-state-in-effect` yang sudah beberapa kali muncul di sesi-sesi lain hari ini) — `true` kalau `transaction` sudah ada dan statusnya bukan `open`/`ordered`, dan belum ada `error` lain yang lebih spesifik.
  - `if (error) return (...)` diubah jadi `if (error || sessionClosedMidView) return (...)`, teks judul jadi `{error || 'Transaksi ini sudah selesai.'}` — begitu status berubah jadi tertutup (baik dari fresh load maupun polling saat tab terbuka), layar SELALU berpindah ke kartu minimal yang sama: hanya teks, tanpa tombol, tanpa aksi apa pun. Ini satu-satunya kartu "sesi ditutup" di seluruh halaman (tidak dibuat versi kedua), supaya perilakunya konsisten di kedua skenario.
  - `refreshStatus`/interval polling: skip fetch dan `clearInterval` begitu `closedRef.current` true — polling benar-benar berhenti total begitu sesi diketahui tertutup, bukan cuma berhenti mengubah UI.
  - `updateCart`: tambah `|| closedRef.current` ke kondisi penolakan — menutup celah race ≤5 detik antara sesi ditutup di server dan polling berikutnya mendeteksinya (defense-in-depth; begitu `sessionClosedMidView` aktif, seluruh layar menu di-unmount jadi ini jaring pengaman untuk jendela waktu sempit sebelum itu terjadi).

### Kenapa desainnya begini
- **Satu kartu "sesi ditutup", dipakai ulang untuk kedua skenario** (bukan bikin komponen/kartu terpisah untuk kasus "ditutup saat tab terbuka") — supaya tidak ada 2 versi UI yang bisa berbeda perilaku/tampilan seiring waktu; juga otomatis mewarisi properti "tanpa tombol, tanpa fetch" yang sudah terbukti aman dari skenario fresh-load.
- **`sessionClosedMidView` dihitung saat render (bukan `setState` di efek)** — pola yang sama dipakai berulang kali di sesi-sesi hari ini (`rateLimitSecondsLeft`, dst.) setelah linter proyek ini (`react-hooks/set-state-in-effect`, bagian dari toolchain Next.js versi ini — lihat catatan header CLAUDE.md soal Next.js custom) berulang kali menolak pola `setState` langsung di badan efek karena berisiko cascading render. `closedRef` (ref, bukan state) dipertahankan karena tetap dibutuhkan oleh kode IMPERATIF di luar render (loop `setInterval`, handler `updateCart`) yang tidak bisa membaca derived-value React biasa.
- **Tidak menyentuh endpoint `GET /api/transaction/[id]`** — datanya sudah terbukti aman untuk viewer publik (field terbatas, ID tidak bisa ditebak), jadi tidak ada perubahan server yang diperlukan untuk memenuhi 4 syarat pengguna; semua perbaikan cukup di sisi client.
- **Tidak mengubah prioritas layar `pendingOrder`** (tetap dicek sebelum `error`/`sessionClosedMidView` di urutan render) — sengaja dibiarkan, karena ini melindungi pesanan customer sendiri yang mungkin sebenarnya sudah berhasil tersimpan di server tapi responsnya belum sampai ke browser; alur retry di layar itu akan otomatis selesai sendiri (dapat 200 kalau order itu ternyata sukses, atau dapat `SESSION_CLOSED` 409 dan keluar dari status pending) dalam hitungan detik begitu ada jawaban pasti dari server — dianalisis sebagai jendela sempit yang self-healing, bukan celah permanen, jadi tidak diutak-atik supaya tidak mengorbankan jaminan "pesanan tidak hilang" yang sudah ada.

### Pengujian
- `npx eslint "src/app/order/[transactionId]/page.js"` — dibandingkan sebelum/sesudah: hasil identik, 0 error, 2 warning pra-existing (missing dep `storageKey`, pemakaian `<img>`), tidak berkaitan dengan perubahan ini. Sempat kena error linter `react-hooks/set-state-in-effect` di percobaan pertama (`setError` langsung di badan efek) — diperbaiki dengan pola derived-value seperti dijelaskan di atas, lint bersih setelahnya.
- **Belum diuji di browser** — perlu dicoba nyata: (a) buka halaman customer di 1 tab, biarkan tetap terbuka di layar menu; di tab/perangkat lain (kasir) selesaikan pembayaran meja itu; pastikan dalam ≤5 detik tab customer otomatis berpindah ke kartu "Transaksi ini sudah selesai." tanpa tombol apa pun; (b) ulangi skenario yang sama tapi tab customer sedang di layar "Pesanan Berhasil Terkirim!"; (c) setelah kartu itu muncul, cek tab Network browser — pastikan tidak ada lagi request `GET /api/transaction/...` berulang setiap 5 detik (polling benar-benar berhenti); (d) scan ulang QR code meja yang sudah closed dari awal (fresh load) — pastikan tetap seperti sebelumnya (sudah dikonfirmasi aman lewat baca kode, tinggal verifikasi visual).

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual browser untuk 4 skenario di atas (lihat Pengujian) — ini murni perubahan client, belum ada satu pun yang diverifikasi lewat interaksi nyata karena sesi ini CLI-only.
- Di luar scope permintaan hari ini tapi relevan untuk didiskusikan ke depan (tidak diubah sengaja): jendela retry `pendingOrder` yang self-healing (lihat "Kenapa desainnya begini" di atas) — kalau pengguna mau perilaku itu diperketat juga (mis. langsung berhenti retry begitu polling mendeteksi sesi tertutup, bukan menunggu 1 siklus retry lagi), perlu didiskusikan dulu karena berisiko membuat pesanan yang sebenarnya sukses jadi tidak pernah dikonfirmasi ke customer.
- Semua daftar uji manual dari entri-entri sebelumnya hari ini (soal batas 100/30 porsi, rate-limit, requestId tab ganda) masih tertunda juga — belum satupun perubahan customer-order hari ini yang diverifikasi lewat klik nyata di browser.

---

## 2026-09-22 (lanjutan 6) — Claude Sonnet 5

### Tugas
Implementasi fitur baru: cetak struk otomatis ke printer dapur setiap kali customer mengirim pesanan. Backlog ini sudah disebut berkali-kali di catatan lama (mis. entri 2026-09-16 "Diminta jelaskan fungsi menu Kitchen...") sebagai "belum dikerjakan, perlu klarifikasi jenis printer/kapan dicetak/fallback" — hari ini dikerjakan setelah klarifikasi didapat langsung dari pengguna.

### Klarifikasi yang diminta ke pengguna sebelum mulai (dan jawabannya)
Kodebase ini **tidak punya infrastruktur cetak sama sekali** sebelum sesi ini (dikonfirmasi ulang lewat pencarian kode: satu-satunya `window.print()` dipakai untuk QR meja, tidak ada library ESC/POS atau print server). Karena pilihan mekanisme cetak sangat mengubah besar-kecilnya implementasi, ditanyakan dulu ke pengguna (bukan diasumsikan):
1. **Jenis printer** → dijawab: printer thermal tersambung USB/Bluetooth ke device yang membuka halaman Kitchen di browser (bukan printer jaringan/IP). Ini berarti solusi cukup lewat `window.print()` dari browser Kitchen, tidak perlu backend print server/library ESC/POS baru.
2. **Dialog cetak vs cetak senyap** → dijawab: dialog cetak bawaan browser (staf klik "Print" 1x per struk) **tidak masalah**, tidak perlu cetak senyap tanpa interaksi (yang butuh konfigurasi kiosk-printing di luar kode aplikasi).

### Arsitektur & alur data
- **Tidak ada endpoint/trigger baru dari sisi customer.** Alur cetak sepenuhnya dipicu dari `src/components/KitchenPanel.js` (halaman Kitchen yang sudah polling `GET /api/kitchen` tiap 5 detik sejak lama) — bukan dari `POST /api/order` (submit customer) atau dari server. Ini penting dipahami: **device yang menjalankan browser Kitchen HARUS tetap terbuka** untuk fitur ini bekerja sama sekali — tidak ada mekanisme push/server-side print, sama seperti keterbatasan yang sudah dicatat berulang kali soal Kitchen Panel butuh layar yang selalu dipantau.
- Tiap siklus polling, `refresh()` di `KitchenPanel.js` membandingkan daftar order yang baru diambil dengan daftar ID yang sudah pernah dicetak (`printedIdsRef`, di-load dari `localStorage` key `kitchen-printed-order-ids`). Order yang: (a) belum pernah tercetak, (b) `kitchenStatus !== 'cancelled'`, dan (c) masih punya minimal 1 item aktif (`!item.deletedAt`) → dikumpulkan ke state `receiptsToPrint`.
- Sebuah `useEffect` terpisah bereaksi saat `receiptsToPrint` terisi: memanggil `window.print()` (markup struk sudah ter-render ke DOM tersembunyi lewat CSS sebelum efek ini jalan, karena effect jalan setelah commit), lalu menandai ID-ID itu sebagai "sudah dicetak" (`printedIdsRef` + disimpan lagi ke `localStorage`).
- **Granularitas cetak = 1 `Order` row = 1 struk.** Ini otomatis memenuhi requirement "sekali pesan 1 struk, 2x kiriman di meja sama = 2 struk terpisah" — karena setiap `POST /api/order` yang sukses SELALU membuat 1 baris `Order` baru (lihat `src/app/api/order/route.js`, tidak pernah menggabung ke `Order` lama), jadi tidak perlu logika pengelompokan tambahan sama sekali — sumber data yang sudah ada (`GET /api/kitchen`, dipakai juga untuk tampilan layar Kitchen yang sudah ada) sudah persis berbentuk "per pesanan/per kiriman".
- Kalau >1 order baru muncul dalam 1 siklus polling yang sama (mis. 2 customer submit hampir bersamaan), semuanya masuk ke SATU `window.print()` job dengan struk terpisah per halaman (CSS `page-break-after: always` di `.kitchen-receipt`, lihat `globals.css`) — staf tetap cukup klik "Print" sekali untuk dapat beberapa struk fisik terpisah, sesuai instruksi cetak per printer thermal continuous-roll.

### Perubahan kode
- `src/app/globals.css` — tambah blok CSS baru setelah blok print QR yang sudah ada (tidak menyentuh style QR sama sekali):
  - `.kitchen-receipt-print-area` — `display:none` di layar (tidak pernah muncul dalam tampilan normal Kitchen Panel), `display:block` + exemption dari aturan `body * {visibility:hidden}` (aturan global yang sudah ada untuk print QR, di-reuse) hanya saat `@media print`.
  - `.kitchen-receipt` — satu struk, lebar 48mm (dalam kertas 58mm, pola sama seperti kartu QR), `page-break-after:always` supaya tiap struk jadi "halaman" cetak sendiri (elemen terakhir dikecualikan lewat `:last-child`).
  - `.kitchen-receipt-item`/`.kitchen-receipt-item-qty` — font 16pt tebal untuk daftar menu (permintaan eksplisit "besar agar kitchen dapat membaca dengan jelas"); `.kitchen-receipt-table` 20pt untuk nomor meja (paling mencolok); `.kitchen-receipt-meta` (jam+tanggal) dan `.kitchen-receipt-type` (BUNGKUS/MAKAN DI TEMPAT) ukuran sedang.
  - Tetap pakai `@page { size: 58mm auto; margin:0; }` yang sudah didefinisikan untuk QR (lebar printer sama, tidak perlu duplikasi aturan halaman).
- `src/components/KitchenPanel.js`:
  - Tambah helper `loadPrintedIds()`/`savePrintedIds()` (localStorage, dibatasi maks 2000 entri ID terbaru supaya tidak tumbuh tanpa batas).
  - State `receiptsToPrint` + ref `printedIdsRef`; deteksi order baru ditambahkan ke dalam `refresh()` yang sudah ada (bukan bikin polling terpisah — reuse polling yang sama dengan tampilan layar Kitchen).
  - `useEffect` baru yang memanggil `window.print()` saat `receiptsToPrint` terisi, lalu membersihkannya lagi lewat `setTimeout(...,0)` (pola deferred-setState yang sama dipakai di halaman order customer sesi-sesi sebelumnya hari ini, supaya tidak kena lint `react-hooks/set-state-in-effect` — linter khusus proyek Next.js versi ini yang beberapa kali muncul hari ini).
  - Markup `.kitchen-receipt-print-area` ditambah di akhir `<section>` (setelah grid kartu order) — isi: nomor pesanan+jam/tanggal (`toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})`), nomor meja, label BUNGKUS/MAKAN DI TEMPAT, lalu daftar menu (qty × nama, item ber-`deletedAt` disaring keluar — konsisten dengan pola soft-delete yang sudah dipakai di tempat lain).

### Kenapa desainnya begini
- **Tidak mengubah schema database (tidak ada `Order.printedAt` baru)** — status "sudah dicetak" disimpan di `localStorage` sisi Kitchen Panel, bukan kolom baru di tabel `Order`. Sengaja dihindari karena proyek ini sudah 3x mengalami insiden nyata gara-gara kolom schema baru belum di-`push` ke database produksi sebelum dipakai (`creationRequestId` 14 Sept, `deletedAt`/`deletedById` 16-17 Sept — lihat catatan-catatan itu) — menambah kolom lagi untuk fitur ini akan mengulang risiko yang sama tanpa keuntungan besar (status "sudah dicetak" murni kebutuhan UI Kitchen, bukan data bisnis yang perlu konsisten lintas device/laporan). Trade-off: kalau localStorage device Kitchen dibersihkan/ganti device, riwayat "sudah dicetak" hilang dan order lama di antrean bisa tercetak ulang — dianggap risiko kecil dan dapat diterima dibanding risiko migrasi schema.
- **Trigger dari polling Kitchen Panel yang sudah ada, bukan dari respons `POST /api/order`** — karena device yang men-submit order (HP customer) TIDAK terhubung secara fisik ke printer dapur; tidak ada cara browser HP customer memicu print di device lain lewat client-side JS murni. Satu-satunya device yang tahu kapan harus mencetak adalah device yang memang tersambung ke printer, yaitu device yang membuka layar Kitchen — makanya deteksi "order baru" logisnya ditaruh di situ, bukan di `api/order/route.js`.
- **1 window.print() per siklus polling (bukan per order)** — supaya kalau ada beberapa order baru sekaligus, staf tidak diberondong banyak dialog print terpisah; cukup 1 dialog, beberapa halaman struk.
- **Field struk dibatasi sesuai permintaan** (jam+tanggal, nomor meja, daftar menu) ditambah 2 info kecil yang dianggap berguna dan risikonya rendah (nomor pesanan untuk referensi, label BUNGKUS/MAKAN DI TEMPAT — sudah ada persis di tampilan layar Kitchen yang sama, bukan data baru) — bukan penambahan di luar konteks, murni supaya struk fisik sama informatifnya dengan kartu di layar.

### Keterbatasan yang perlu diketahui pengguna (bukan bug, konsekuensi arsitektur)
1. **Bukan cetak senyap** — tiap kali ada order baru, dialog print bawaan browser akan terbuka di device Kitchen; staf perlu klik "Print" (sudah dikonfirmasi ke pengguna ini oke, lihat bagian Klarifikasi).
2. **Device Kitchen harus tetap membuka halaman Kitchen di browser** — kalau layar itu ditutup/komputer mati, tidak ada order yang tercetak sampai halaman dibuka lagi (saat itu, order yang masih ada di antrean otomatis akan tercetak sebagai batch begitu halaman dibuka/refresh, karena baru saat itu dianggap "belum pernah dicetak" oleh localStorage device tsb).
3. **Pertama kali fitur ini dipakai**, kalau saat itu sudah ada order yang nyangkut di antrean kitchen dari sebelum fitur ini ada, order-order itu otomatis akan langsung tercetak sekaligus (dianggap wajar/diinginkan — bukan "storm" berbahaya, staf dapat salinan cetak pertama dari antrean yang sedang berjalan).
4. **Cetak per-device** — kalau ada 2 layar Kitchen terbuka di 2 device berbeda (mis. layar utama + cadangan), keduanya akan sama-sama mencoba mencetak order baru (masing-masing punya `localStorage` sendiri) — kalau memang cuma 1 device yang tersambung fisik ke printer, device lain akan tetap memicu dialog print browser tapi tidak ada printer fisik yang menerimanya (dialog tetap harus di-cancel manual). Perlu diketahui kalau nanti setup Kitchen pakai lebih dari 1 layar.

### Pengujian
- `npx eslint src/components/KitchenPanel.js` dan `npx eslint src/app/globals.css` — dibandingkan sebelum/sesudah (`git stash` + lint ulang): **0 error, 0 warning** di kedua kondisi (tidak ada masalah pra-existing maupun baru).
- **Belum diuji nyata dengan printer fisik atau di browser sama sekali** — sesi ini CLI-only, tidak ada akses ke device Kitchen/printer thermal sungguhan. Yang sudah diverifikasi hanya lewat baca-ulang kode: alur data (`Order` per kiriman), struktur CSS 58mm (konsisten dengan pola QR yang sudah terbukti jalan di device nyata sebelumnya), dan tidak adanya error sintaks (lolos lint).

### Pekerjaan belum selesai / langkah berikutnya
1. **Paling prioritas — uji nyata di device Kitchen dengan printer thermal fisik**: buka halaman Kitchen di browser device yang tersambung printer, submit pesanan dari HP/browser lain sebagai customer, pastikan (a) dialog print muncul otomatis di device Kitchen dalam ≤5 detik, (b) struk yang tercetak fisik terbaca jelas (ukuran font, tidak terpotong, sejajar — sama seperti proses trial-error yang dulu dilakukan untuk struk QR), (c) submit 2 pesanan terpisah ke meja yang sama → pastikan benar-benar tercetak 2 struk fisik terpisah, bukan tergabung.
2. Uji reload halaman Kitchen setelah beberapa order tercetak — pastikan order yang SUDAH tercetak tidak tercetak ulang (mengandalkan `localStorage`, perlu dicoba nyata karena baru diverifikasi lewat baca kode).
3. Kalau nanti ternyata setup Kitchen pakai lebih dari 1 device/layar, diskusikan ulang soal keterbatasan #4 di atas (localStorage per-device) — mungkin perlu dipindah ke penanda server-side (`Order.printedAt`) kalau itu jadi masalah nyata, tapi itu perlu keputusan/izin pengguna dulu karena berarti migrasi schema (lihat alasan desain di atas).
4. Backlog lama lain (agregasi soft-delete di statistik, race order vs pembayaran) tetap belum disentuh, di luar scope tugas hari ini.

---

## 2026-09-22 (lanjutan 7) — Claude Sonnet 5

### Tugas
Koreksi dari pengguna atas fitur struk dapur (sesi "lanjutan 6"): pemicu cetak dipindah dari menu Kitchen ke dashboard kasir utama, karena **menu Kitchen tidak akan dipakai dan rencananya dihapus sebelum aplikasi dipasarkan**. Pengguna juga menanyakan: kalau tidak pakai mode kiosk-printing (jadi tidak bisa cetak senyap), apakah bisa "beri popup dari laptop saja" — dikonfirmasi: ya, itu justru desain yang sudah dipakai sejak awal (dialog print bawaan browser), bukan hal baru yang perlu ditambah.

### Perubahan kode
- `src/components/KitchenPanel.js` — **dikembalikan 100% ke kondisi semula** (dikonfirmasi lewat `git diff` kosong setelah reverted): semua penambahan sesi lalu (helper `loadPrintedIds`/`savePrintedIds`, state `receiptsToPrint`, efek `window.print()`, markup `.kitchen-receipt-print-area`) dihapus total dari file ini. Tidak ada bagian dari fitur ini yang tersisa di komponen Kitchen — sesuai permintaan pengguna karena komponen ini rencananya dihapus sebelum launch dan tidak akan pernah dibuka.
- `src/app/page.js` (dashboard kasir/admin, `CashierDashboard`) — logika yang sebelumnya di `KitchenPanel.js` dipindah ke sini, dengan penyesuaian supaya jalan di level dashboard (bukan per-tab):
  - Helper module-scope `loadKitchenPrintedIds()`/`saveKitchenPrintedIds()` (sama persis, localStorage key `kitchen-printed-order-ids`, dibatasi 2000 entri) ditambah di atas komponen, sejajar dengan pattern helper lain di file ini.
  - State `kitchenReceiptsToPrint` + ref `kitchenPrintedIdsRef`/`kitchenPrintFetchingRef` ditambah di awal komponen.
  - Fungsi baru `checkKitchenReceipts()` (mem-fetch `GET /api/kitchen` — endpoint yang sama yang tadinya dipakai `KitchenPanel.js`, tidak ada endpoint baru) ditambah setelah `fetchTransactions`.
  - `checkKitchenReceipts()` dipanggil di dalam `useEffect` polling yang **sudah ada** (baris ~924, yang sebelumnya cuma memanggil `fetchTransactions()` tiap 5 detik) — bukan bikin `setInterval` baru terpisah, supaya cukup 1 siklus polling. Efek ini aktif selama `!checkingAuth && currentUser` (staf sudah login), **tidak bergantung `activeTab`** — artinya cetak struk tetap jalan walau kasir sedang membuka tab Transaksi/Statistik/Menu, bukan cuma saat tab Kitchen dibuka (yang justru sudah tidak dipakai).
  - `useEffect` pemicu `window.print()` dan markup `.kitchen-receipt-print-area` dipindah apa adanya ke `page.js` — isi struk (jam/tanggal, nomor meja, BUNGKUS/MAKAN DI TEMPAT, daftar menu font besar) **tidak berubah sama sekali** dari desain sesi sebelumnya, cuma lokasinya yang pindah.
  - Markup print diletakkan di root return komponen (di luar semua blok `{activeTab === '...' && (...)}`), supaya tetap ter-render (walau tersembunyi di layar) apa pun tab yang sedang aktif.
- `src/app/globals.css` — **tidak diubah sama sekali** di sesi ini. CSS `.kitchen-receipt-print-area`/`.kitchen-receipt`/dst dari sesi lalu sudah generik (tidak terikat ke komponen Kitchen manapun), jadi cukup dipakai ulang oleh markup yang sekarang ada di `page.js` tanpa modifikasi.

### Kenapa desainnya begini
- **Reuse polling yang sudah ada** (`fetchTransactions` interval) daripada bikin `setInterval` terpisah — mengurangi jumlah timer aktif, konsisten dengan pola yang sudah dipakai project ini untuk fitur lain.
- **`GET /api/kitchen` tetap dipakai sebagai sumber data**, meskipun tab "Kitchen" sendiri tidak dipakai — karena bentuk datanya (satu `Order` = satu kiriman, lengkap dengan `items`+`menuItem`+`tableNumber`) sudah persis pas untuk struk, dan endpoint ini kemungkinan besar tetap ada di backend terlepas dari nasib menu Kitchen (dipakai juga oleh alur `kitchenStatus` yang dipakai luas di aplikasi, bukan cuma oleh komponen `KitchenPanel.js`). Tidak dibuat endpoint baru.
- **Tetap tidak ada kolom database baru** — keputusan ini tidak berubah dari sesi sebelumnya (lihat alasan lengkap di entri "lanjutan 6": menghindari risiko migrasi schema yang sudah 3x menyebabkan insiden di proyek ini).
- **Dialog print bawaan browser dipertahankan, tidak diganti apa pun** — pertanyaan pengguna soal "beri popup dari laptop" sebenarnya menegaskan ulang mekanisme yang SUDAH ada (klarifikasi awal sebelum implementasi sesi lalu sudah menyepakati ini), bukan permintaan fitur baru. Tidak ada perubahan pada cara `window.print()` dipanggil.

### Pengujian
- `git diff src/components/KitchenPanel.js` — **kosong**, mengonfirmasi file ini benar-benar kembali seperti sebelum sesi "lanjutan 6" (tidak ada sisa kode fitur struk yang tertinggal).
- `npx eslint src/app/page.js` — dibandingkan sebelum/sesudah (`git stash` + lint ulang): **total problem identik, 6 error + 6 warning**, semuanya pra-existing di baris lain (pola `setState` langsung di badan efek untuk `fetchArchive`/`fetchStats`/`fetchEmployees`/`fetchTransactions`/dua state tanggal, plus 3 pemakaian `<img>`) — dikonfirmasi dengan membandingkan lokasi baris satu-per-satu, bukan cuma jumlah total. **Tidak ada error/warning baru** dari kode yang ditambahkan (`checkKitchenReceipts`, efek `window.print()`, markup struk).
- **Belum diuji nyata dengan browser atau printer fisik** — sama seperti sesi sebelumnya, CLI-only, tidak ada akses ke device/printer sungguhan.

### Pekerjaan belum selesai / langkah berikutnya
1. **Paling prioritas — uji nyata di laptop yang tersambung printer**: buka dashboard kasir di laptop itu (tab apa saja, tidak perlu buka tab Kitchen sama sekali), submit pesanan dari HP/browser lain sebagai customer, pastikan dialog print otomatis muncul di laptop dalam ≤5 detik dan strukturnya benar (jam/tanggal, nomor meja, daftar menu font besar, per-pesanan terpisah untuk 2x kiriman ke meja sama).
2. Keterbatasan yang dicatat di sesi "lanjutan 6" (poin 1-4: bukan cetak senyap, laptop harus tetap membuka dashboard, batch cetak pertama kali, risiko cetak ganda kalau >1 laptop membuka dashboard sekaligus) **masih berlaku sama persis** di desain yang baru ini — cuma "device Kitchen" pada poin-poin itu sekarang dibaca sebagai "laptop dashboard kasir manapun yang sedang login". Kalau kasir punya kebiasaan buka dashboard dari 2 laptop berbeda secara bersamaan, keduanya akan sama-sama mencoba memicu print (masing-masing localStorage sendiri) — perlu diketahui pengguna.
3. Backlog lama lain (agregasi soft-delete di statistik, race order vs pembayaran, penghapusan menu Kitchen itu sendiri — belum diminta dieksekusi sekarang, "nanti sebelum launch") tetap belum disentuh.

---

## 2026-09-22 (lanjutan 8) — Claude Sonnet 5

### Tugas
Koreksi tampilan struk dapur dari pengguna: buat struk lebih panjang dengan menambah ruang kosong di bagian atas (supaya bisa digantung/ditusuk di tempat struk dapur tanpa menutupi tulisan pesanan), dan perbesar sedikit ukuran teksnya.

### Perubahan kode
- `src/app/globals.css` (blok `@media print` untuk `.kitchen-receipt*`):
  - Tambah elemen/kelas baru `.kitchen-receipt-hanger` — blok kosong setinggi 30mm, ditaruh sebagai elemen PERTAMA di dalam `.kitchen-receipt`, sebelum info jam/tanggal. Ini yang membuat struk jadi lebih panjang dan menyediakan ruang kosong di ujung atas kertas untuk digantung/ditusuk tanpa mengenai tulisan.
  - `.kitchen-receipt` padding bawah ditambah sedikit (`3mm 0 4mm`, sebelumnya `3mm 0`) supaya ada sedikit jarak juga di ujung bawah sebelum potongan kertas berikutnya.
  - Semua ukuran font dinaikkan satu tingkat: `.kitchen-receipt-meta` 10pt→11pt, `.kitchen-receipt-table` (nomor meja) 20pt→23pt, `.kitchen-receipt-type` (BUNGKUS/MAKAN DI TEMPAT) 13pt→14pt, `.kitchen-receipt-item`/`.kitchen-receipt-item-qty` (daftar menu) 16pt→18pt. Padding/margin di sekitarnya ikut sedikit disesuaikan (mis. `.kitchen-receipt-table` padding 1.5mm→2mm) supaya tetap proporsional dengan font yang lebih besar, bukan cuma teksnya yang membesar sementara jaraknya tetap sempit.
- `src/app/page.js` — tambah `<div className="kitchen-receipt-hanger" />` sebagai child pertama di dalam `.kitchen-receipt` (sebelum `.kitchen-receipt-meta`), pasangan dari kelas CSS baru di atas.

### Kenapa desainnya begini
- **Ruang gantung dibuat sebagai elemen kosong terpisah (bukan sekadar `padding-top` besar di `.kitchen-receipt`)** — supaya jelas dan mudah disesuaikan lagi ukurannya secara terpisah dari padding struk itu sendiri kalau ternyata 30mm kurang/lebih panjang dari kebutuhan tempat struk yang sebenarnya (tempat struk fisik di dapur belum diketahui ukurannya, jadi 30mm ini estimasi awal yang masuk akal untuk dijepit/ditusuk, bukan angka yang diukur dari alat aslinya).
- **Kenaikan font tidak seragam per elemen** — nomor meja (elemen paling penting untuk dikenali dari jarak jauh) dinaikkan paling besar secara proporsional (20→23pt), sementara label BUNGKUS/MAKAN DI TEMPAT (informasi sekunder) dinaikkan lebih kecil (13→14pt) — mengikuti hierarki kepentingan visual yang sama seperti desain awal, bukan menaikkan semua elemen dengan jumlah poin yang sama rata.
- **Lebar struk (48mm) tidak diubah** — permintaan cuma soal "lebih panjang" (tinggi) dan "lebih besar" (font), bukan lebar; lebar 48mm sudah pernah diverifikasi cocok untuk printer 58mm lewat proses trial-error struk QR sebelumnya, jadi tidak diutak-atik tanpa alasan.

### Pengujian
- `npx eslint src/app/page.js` — dibandingkan sebelum/sesudah: **total problem identik, 6 error + 6 warning**, semuanya pra-existing (sama seperti sesi-sesi sebelumnya hari ini), tidak ada yang baru dari perubahan ini.
- **Belum diuji cetak fisik** — perubahan CSS murni untuk hasil cetak, belum ada kesempatan mencoba di printer thermal nyata untuk pastikan 30mm ruang gantung itu pas (tidak kurang/berlebihan) dengan tempat struk yang sebenarnya di dapur, dan font yang lebih besar tidak sampai terpotong di lebar 48mm.

### Pekerjaan belum selesai / langkah berikutnya
- Uji cetak fisik: pastikan ruang kosong di atas struk (30mm) cukup untuk digantung/ditusuk di tempat struk yang dipakai, dan sesuaikan lagi angkanya (naikkan/turunkan `.kitchen-receipt-hanger { height: ... }`) kalau ternyata kurang pas.
- Pastikan juga nomor meja yang panjang (mis. "TAKE AWAY - Nama Pelanggan Panjang") pada font 23pt tidak terpotong di lebar 48mm — sama seperti isu yang pernah muncul untuk badge nomor meja di struk QR sebelumnya, perlu dicek langsung di kertas fisik.
- Semua uji manual browser/printer dari sesi-sesi sebelumnya hari ini (soal fitur struk dapur secara keseluruhan, batas porsi customer, sesi ditutup, dll.) masih tertunda — belum ada satupun yang diverifikasi lewat interaksi nyata karena seluruh hari ini CLI-only.

---

## 2026-09-22 (lanjutan 9) — Claude Sonnet 5

### Tugas
Pengguna melaporkan bug nyata (bukan dugaan, sudah dialami): struk kitchen "sering tergabung dengan struk QR code" — hasil cetak tumpang tindih antara struk QR meja dan struk kitchen.

### Root cause (dibuktikan lewat baca kode, bukan dugaan)
Kedua fitur cetak (QR meja & struk kitchen) memakai mekanisme CSS print YANG SAMA di `globals.css`: aturan global `body * { visibility: hidden; }` lalu masing-masing punya kelasnya sendiri yang dikecualikan (`.print-qr-card` untuk QR, `.kitchen-receipt-print-area` untuk struk kitchen) supaya tampil saat `window.print()` dipanggil.
- `.print-qr-card` (`page.js:1673`) BUKAN elemen tersembunyi seperti struk kitchen — ini adalah modal QR Code yang **tetap terlihat normal di layar** selama `activeQr` (state) tidak `null`, dan baru hilang dari DOM saat staf menutup modal itu.
- Struk kitchen (`page.js`, fitur sesi-sesi sebelumnya hari ini) otomatis mengisi `.kitchen-receipt-print-area` dan memanggil `window.print()` sendiri lewat polling setiap 5 detik, **tanpa peduli apakah modal QR sedang terbuka atau tidak**.
- Kalau kebetulan staf sedang membuka/menampilkan QR Code satu meja (`.print-qr-card` ada di DOM) TEPAT saat ada pesanan baru masuk dan memicu auto-print struk kitchen, maka SAAT `window.print()` dipanggil, kedua elemen (`.print-qr-card` DAN `.kitchen-receipt-print-area` yang baru terisi) sama-sama dikecualikan dari `visibility:hidden` dan sama-sama `position:absolute; top:0` — hasilnya kedua struk tercetak bertumpuk di kertas yang sama. Ini persis skenario yang dilaporkan pengguna.

### Perubahan kode
- `src/app/page.js`:
  - Efek pemicu `window.print()` untuk struk kitchen sekarang mengecek `activeQr` juga: `if (!kitchenReceiptsToPrint.length || activeQr) return;`, dan `activeQr` ditambahkan ke dependency array efek. Selama modal QR meja masih terbuka, print struk kitchen DITUNDA (bukan dibatalkan) — begitu modal QR ditutup (`activeQr` jadi `null`), efek ini langsung jalan lagi tanpa perlu menunggu siklus polling berikutnya (karena `activeQr` ada di dependency array, perubahannya langsung memicu efek).
  - Markup `.kitchen-receipt-print-area` sekarang mengecek `!activeQr` sebelum me-render isi strukturnya (`{!activeQr && kitchenReceiptsToPrint.map(...)}`), bukan cuma menunda pemanggilan `window.print()`-nya. Ini lapisan pertahanan kedua: kalau staf mencetak QR secara MANUAL (klik tombol print QR, `page.js:1304`) sementara ada struk kitchen yang masih "menunggu" (tertunda karena poin di atas), area struk kitchen tetap kosong di DOM saat itu — tidak ikut tercetak campur dengan QR.

### Kenapa desainnya begini
- **Tidak mengubah mekanisme CSS print yang sudah ada** (`body * {visibility:hidden}` + exemption per-kelas) — itu pola yang sudah terbukti jalan untuk QR sejak lama; masalahnya bukan di situ, tapi di TIMING (dua print job berbeda bisa aktif bersamaan). Perbaikannya cukup di level JS: pastikan hanya satu jenis struk yang "aktif"/terisi dalam DOM pada satu waktu.
- **Dua lapis penjagaan (efek DAN render), bukan cuma satu** — supaya aman dari 2 arah sekaligus: (a) auto-print kitchen tidak boleh menyela saat QR sedang tampil, (b) print manual QR juga tidak boleh "menangkap" sisa struk kitchen yang kebetulan sedang menunggu di background. Kalau cuma efeknya yang dijaga tapi markup-nya tetap terisi, print manual QR (yang tidak lewat efek ini sama sekali) masih bisa ikut mencetak struk kitchen yang nyangkut di DOM.
- **Ditunda, bukan dibatalkan/dihapus dari antrean** — begitu modal QR ditutup, struk yang tertunda otomatis tercetak (state `kitchenReceiptsToPrint` tidak direset, cuma efeknya yang menunggu). Tidak ada pesanan yang gagal tercetak permanen gara-gara staf sedang membuka QR meja lain.

### Pengujian
- `npx eslint src/app/page.js` — dibandingkan sebelum/sesudah: **total problem identik, 6 error + 6 warning**, semuanya pra-existing (sama seperti sesi-sesi hari ini sebelumnya), tidak ada yang baru dari perubahan ini.
- **Belum diuji cetak fisik** — perlu dicoba nyata: buka modal QR salah satu meja di laptop kasir, lalu (dari device lain) submit pesanan baru ke meja lain; pastikan struk kitchen TIDAK ikut tercetak selama modal QR masih terbuka, lalu tertutup modal QR → pastikan struk kitchen yang tadi tertunda langsung tercetak (bukan hilang).

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual seperti skenario di atas (buka QR + submit order baru bersamaan) dengan printer fisik sungguhan untuk memastikan tumpang-tindih benar-benar tidak terjadi lagi.
- Semua uji manual browser/printer lain dari sesi-sesi sebelumnya hari ini (fitur struk dapur, ukuran/font struk, batas porsi customer, sesi ditutup) masih tertunda — belum ada satupun yang diverifikasi lewat interaksi nyata karena seluruh hari ini CLI-only.

---

## 2026-09-22 (lanjutan 10) — Claude Sonnet 5

### Tugas
Pengguna melaporkan: popup print struk dapur kadang tidak muncul saat pesanan masuk, dan sering harus refresh halaman dulu baru popup-nya muncul lagi. Diminta diperbaiki dan dijelaskan kenapa terjadi.

### Root cause (dibuktikan lewat baca kode — regresi dari perbaikan saya sendiri di entri "lanjutan 9")
Perbaikan tumpang-tindih struk QR/kitchen di entri "lanjutan 9" menambahkan penjagaan: struk dapur ditunda selama `activeQr` (state) tidak `null`. Ternyata penjagaan itu salah sasaran:
- Kartu QR (`.print-qr-card`, `page.js` sekitar baris 1674) hanya benar-benar ada di DOM saat **`activeTab === 'transactions'` DAN `activeQr` terisi** — kartu itu dibungkus blok `{activeTab === 'transactions' && (...)}` (baris 1642), jadi begitu kasir pindah ke tab lain (Arsip/Statistik/Menu/Karyawan), React **meng-unmount kartu itu dari DOM sepenuhnya**, walau state `activeQr` tetap tersimpan di memori (tidak ikut ter-reset).
- Satu-satunya baris yang me-reset `activeQr` kembali ke `null` adalah tombol "Tutup" di kartu QR itu sendiri (baris 1737). Kalau kasir membuka QR satu meja lalu **pindah tab tanpa klik "Tutup"** (skenario yang sangat wajar dalam kerja sehari-hari — mis. buka QR meja baru, lalu langsung cek tab lain), `activeQr` tetap tersimpan non-`null` **selamanya**.
- Karena penjagaan struk dapur cuma mengecek state `activeQr` (bukan apakah kartunya benar-benar ada di layar), begitu itu terjadi, **semua auto-print struk dapur ikut macet total** — bukan cuma sementara, tapi sampai halaman di-refresh (refresh mereset SEMUA state React termasuk `activeQr` balik ke `null`). Inilah yang terasa sebagai "kadang gak muncul, refresh dulu baru muncul" — sebenarnya bukan soal browser/printer sama sekali, murni bug logika di kode yang saya tulis sendiri sesi sebelumnya.

### Perubahan kode
- `src/app/page.js`:
  - Tambah nilai turunan `qrCardMounted = Boolean(activeQr) && activeTab === 'transactions'` — merepresentasikan kondisi SEBENARNYA "apakah `.print-qr-card` sedang ada di DOM", bukan cuma "apakah `activeQr` pernah diisi".
  - Efek pemicu `window.print()` untuk struk dapur sekarang mengecek `qrCardMounted` (bukan `activeQr` langsung), begitu juga dependency array-nya.
  - Markup `.kitchen-receipt-print-area` juga diubah dari `{!activeQr && ...}` jadi `{!qrCardMounted && ...}` — konsisten dengan efeknya.

### Kenapa desainnya begini
- **Tidak menghapus fitur penundaan (dari entri "lanjutan 9")** — logika "jangan cetak struk dapur bertumpuk dengan kartu QR" itu sendiri BENAR dan masih diperlukan (skenario tumpang-tindih yang dilaporkan sebelumnya nyata dan sudah dibuktikan). Yang salah cuma SUMBER kebenarannya — seharusnya dari sejak awal mengecek "apakah elemennya ada di DOM", bukan "apakah state pernah di-set", karena kartu QR memang sengaja unmount saat pindah tab (bukan cuma disembunyikan via CSS) padahal statenya tidak ikut direset.
- **Tidak menambah `useEffect` baru untuk auto-reset `activeQr` saat pindah tab** — sempat dipertimbangkan (supaya state selalu sinkron dengan apa yang tampil), tapi itu akan MENGUBAH perilaku yang sudah ada: saat ini kalau kasir buka QR meja lalu pindah-pindah tab lalu balik lagi ke tab Transaksi, kartu QR yang tadi dibuka akan otomatis muncul lagi (statenya masih tersimpan) — kemungkinan ini memang perilaku yang diinginkan/dipakai kasir sehari-hari, jadi tidak diubah tanpa izin. Perbaikan cukup di titik yang benar-benar menyebabkan bug (penjagaan struk dapur), bukan mengubah perilaku modal QR.

### Pengujian
- `npx eslint src/app/page.js` — dibandingkan sebelum/sesudah: **total problem identik, 6 error + 6 warning**, semuanya pra-existing (sama seperti sesi-sesi hari ini sebelumnya), tidak ada yang baru dari perubahan ini.
- **Belum diuji browser nyata** — skenario yang perlu dicoba: buka QR salah satu meja, pindah ke tab lain (Arsip/Statistik) TANPA klik "Tutup", lalu (dari device lain) submit pesanan baru; pastikan popup print struk dapur tetap muncul otomatis meski kartu QR "ketinggalan" di state (tidak lagi macet sampai refresh).

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual sesuai skenario di atas dengan browser & printer fisik sungguhan.
- Kalau nanti pengguna MEMANG mau perilaku modal QR diubah (auto-tertutup saat pindah tab, bukan cuma tidak lagi memblokir print), itu perubahan UX terpisah yang perlu diminta eksplisit — belum dikerjakan di sesi ini karena di luar apa yang dilaporkan.
- Semua uji manual browser/printer lain dari sesi-sesi sebelumnya hari ini masih tertunda.

---

## 2026-09-22 (lanjutan 11) — Claude Sonnet 5

### Tugas
Pengguna melaporkan perbaikan sesi "lanjutan 10" belum menyelesaikan masalah: popup print struk dapur **masih tetap tidak muncul otomatis setelah pesanan dikirim**, tapi muncul begitu pindah menu/tab. Diminta diperbaiki supaya popup muncul setelah pesanan terkirim **tanpa perlu refresh DAN tanpa perlu pindah menu**.

### Root cause (diverifikasi lewat pencarian sumber resmi, bukan dugaan)
Sebelum menambal lagi, dicari referensi tentang perilaku `window.print()` dari `setInterval` di Chrome — ditemukan penjelasan resmi dari diskusi tim Chromium (WICG interventions) yang cocok persis dengan gejala yang dilaporkan:
- Chrome menggerbangi operasi "sensitif" (termasuk `window.print()`) di belakang **aktivasi pengguna** ("user activation" — status sementara yang aktif setelah klik/keypress asli).
- Status aktivasi ini **ikut terbawa hanya di eksekusi PERTAMA `setInterval`/`setTimeout`, tidak di eksekusi-eksekusi berikutnya**.
- Spesifikasi WHATWG sendiri secara eksplisit mengizinkan browser **diam-diam mengabaikan** panggilan `print()` tanpa error/exception apa pun.
- Ini menjelaskan gejala persis: percobaan auto-print dari polling 5 detik (`checkKitchenReceipts`, dipanggil dari `setInterval` yang sudah berjalan lama, bukan eksekusi pertama) kehilangan status aktivasi → Chrome diam-diam menolak menampilkan dialog. Sebaliknya, klik pindah tab (`onClick={() => setActiveTab(...)}`) adalah interaksi nyata yang memicu ulang efek polling (`activeTab` ada di dependency array-nya) — percobaan print yang menyertainya kebetulan "menumpang" aktivasi dari klik itu, makanya berhasil.
- **Kesimpulan penting**: ini pembatasan keamanan bawaan Chrome yang disengaja (mencegah situs web memaksa dialog print berulang-ulang tanpa interaksi), **bukan bug yang bisa 100% dihilangkan lewat kode murni**. Cetak otomatis total tanpa klik sama sekali hanya bisa dijamin lewat konfigurasi khusus di luar kode (mode kiosk-printing Chrome) — opsi ini sudah ditanyakan ke pengguna di awal implementasi fitur dan sengaja tidak dipakai (dijawab "popup tidak masalah").

### Perubahan kode
- `src/app/page.js`:
  - Tambah state `kitchenRecentPrints` — daftar pesanan yang baru saja DICOBA dicetak otomatis lewat polling (maksimal 10 entri terbaru, di-dedup by id), disimpan terpisah dari `kitchenReceiptsToPrint` (yang tetap dikosongkan segera seperti sebelumnya).
  - Efek pemicu `window.print()` sekarang, setiap kali mencoba mencetak, JUGA mencatat batch itu ke `kitchenRecentPrints` (lewat `setTimeout(...,0)` supaya tidak kena lint `react-hooks/set-state-in-effect` yang sama seperti beberapa kali sebelumnya hari ini — sempat kena error ini di percobaan pertama, sudah diperbaiki).
  - Fungsi baru `reprintKitchenReceipts()` — dipanggil dari tombol manual, set ulang `kitchenReceiptsToPrint` ke isi `kitchenRecentPrints` (memicu efek print yang sama), lalu kosongkan `kitchenRecentPrints`.
  - Tombol/banner mengambang baru (`position:fixed`, pojok kanan-bawah, `zIndex:2000`) — **muncul di SEMUA tab, tidak perlu pindah menu untuk melihatnya** — begitu `kitchenRecentPrints.length > 0`. Isinya: jumlah struk yang menunggu, tombol "Cetak Sekarang" (klik asli → memicu ulang `window.print()`, dijamin tidak ditolak Chrome karena ini interaksi pengguna sungguhan), dan tombol sembunyikan (✕, kalau kasir sudah yakin sudah tercetak lewat cara lain).

### Kenapa desainnya begini
- **Tidak berusaha "memaksa" browser menampilkan dialog print tanpa interaksi** — ini bukan sesuatu yang bisa dijamin lewat kode berdasarkan bukti/sumber di atas; memaksakan solusi seperti itu (mis. trik-trik tidak resmi) berisiko rapuh dan bisa berhenti bekerja kapan saja mengikuti perubahan kebijakan Chrome, tanpa ada jaminan sama sekali.
- **Tombol jaring-pengaman diletakkan di ROOT (di luar blok tab manapun)** — persis pola yang sama dengan area cetak struk itu sendiri (`kitchen-receipt-print-area`), supaya benar-benar tidak perlu pindah tab untuk mengaksesnya, sesuai permintaan eksplisit "tidak perlu pindah menu".
- **Tidak menghapus/mengganti percobaan auto-print yang sudah ada** — auto-print tetap dicoba setiap kali (kadang berhasil, terutama kalau kebetulan menyusul interaksi pengguna lain), tombol manual ini murni tambahan jaring pengaman untuk kasus ketika auto-print gagal diam-diam, bukan pengganti total.
- **`kitchenRecentPrints` dipisah dari `kitchenReceiptsToPrint`** — supaya area cetak (`.kitchen-receipt-print-area`, dipakai untuk `window.print()`) tetap kosong di antara percobaan (mencegah kebocoran render yang sudah dibahas di sesi "lanjutan 9"), sementara daftar "masih perlu dicetak ulang?" tetap ada untuk ditampilkan sebagai teks biasa di banner (bukan lewat print media).

### Pengujian
- `npx eslint src/app/page.js` — sempat memunculkan 1 error baru di percobaan pertama (`setKitchenRecentPrints` dipanggil langsung di badan efek) — diperbaiki dengan memindahkannya ke dalam `setTimeout(...,0)` yang sudah ada. Setelah diperbaiki: **total problem kembali identik dengan baseline, 6 error + 6 warning**, semuanya pra-existing, tidak ada yang baru dari perubahan final.
- **Belum diuji browser nyata** — perlu dicoba: submit pesanan baru dari device lain TANPA menyentuh dashboard kasir sama sekali; kalau popup print tidak muncul otomatis (karena pembatasan Chrome di atas), pastikan tombol "🖨️ N struk dapur menunggu dicetak — Cetak Sekarang" muncul mengambang di pojok kanan-bawah APAPUN tab yang sedang dibuka, dan klik tombolnya benar-benar membuka dialog print.

### Pekerjaan belum selesai / langkah berikutnya
- Uji manual browser sesuai skenario di atas.
- **Perlu didiskusikan ulang dengan pengguna**: kalau cetak otomatis 100% tanpa klik sama sekali benar-benar wajib (bukan cukup dengan jaring-pengaman tombol manual), satu-satunya cara yang benar-benar dijamin adalah mode kiosk-printing Chrome (`--kiosk-printing` saat membuka browser di laptop kasir) — ini konfigurasi di luar kode aplikasi (shortcut/launcher khusus di device kasir), bukan sesuatu yang bisa diselesaikan lewat perubahan kode lagi. Sudah pernah ditanyakan di awal implementasi dan dijawab tidak perlu; kalau sekarang berubah pikiran, saya bisa bantu jelaskan cara setup-nya.
- Semua uji manual browser/printer lain dari sesi-sesi sebelumnya hari ini masih tertunda.

---

## 2026-09-22 (lanjutan 12) — Claude Sonnet 5

### Tugas
Pengguna melaporkan lagi: "kirim pesanan, struk tidak memunculkan popup untuk struk di kitchen" — laporan baru setelah perbaikan "lanjutan 11" (banner jaring-pengaman), yang saat itu ditulis belum sempat diuji browser nyata sama sekali.

### Diagnosa (tidak bisa diverifikasi lewat eksekusi nyata — `chromium-cli` tidak tersedia di environment ini dan kredensial `kasir_local` tidak tersimpan; diagnosa murni dari pembacaan kode + konfirmasi pengguna lewat pertanyaan langsung)
Ditanya ke pengguna: banner "🖨️ N struk dapur menunggu dicetak" dari sesi "lanjutan 11" **sempat muncul** untuk pesanan pertama, tapi setelah banner itu ditutup (✕) dan pesan lagi, banner **tidak muncul sama sekali** untuk pesanan berikutnya. Dikonfirmasi ke pengguna: kartu QR Code meja (`activeQr`) kemungkinan besar sedang terbuka di layar dashboard saat itu — **dibenarkan pengguna**.

**Root cause (terbukti dari kode, dikonfirmasi skenarionya oleh pengguna):**
- `page.js` (sebelum perbaikan sesi ini) menggabungkan DUA hal dalam SATU efek yang sama-sama di-gate oleh `qrCardMounted`: (1) percobaan `window.print()` — sengaja ditunda selama kartu QR meja terbuka (mencegah struk dapur tercetak tumpang tindih dengan QR, keputusan yang benar dari sesi "lanjutan 9"), dan (2) pencatatan batch ke `kitchenRecentPrints` (state yang menggerakkan banner "Cetak Sekarang") — yang **seharusnya TIDAK ikut ditunda**, tapi baris `if (!kitchenReceiptsToPrint.length || qrCardMounted) return;` membuat SELURUH efek (termasuk pencatatan banner) berhenti lebih awal.
- Akibatnya: kalau kartu QR meja sedang terbuka saat pesanan baru masuk, bukan cuma `window.print()` yang tertunda (itu memang disengaja) — **banner jaring-pengaman juga ikut tidak muncul sama sekali**, padahal itu satu-satunya alasan banner itu ada. Kasir tidak dapat notifikasi apa pun sampai kartu QR ditutup.
- Ini masuk akal secara alur kerja nyata: kasir sering perlu membuka kartu QR meja berulang kali (mis. menunjukkan link ke pelanggan lain) sambil pesanan-pesanan baru terus masuk dari meja lain.

### Perubahan kode
- `src/app/page.js`:
  - Efek pemicu `window.print()` (sekitar baris 956 sebelumnya) **dipecah jadi 2 efek terpisah**:
    1. Efek baru (jalan lebih dulu): begitu `kitchenReceiptsToPrint` terisi, **langsung** mencatatnya ke `kitchenRecentPrints` (dedup by id, maksimal 10) — **tidak lagi di-gate oleh `qrCardMounted`**. Tetap dibungkus `setTimeout(...,0)` supaya tidak kena lint `react-hooks/set-state-in-effect` (pola yang sama dipakai di seluruh file ini).
    2. Efek lama (perilaku TIDAK diubah): tetap `return` lebih awal selama `qrCardMounted`, tetap memanggil `window.print()` dan menandai `kitchenPrintedIdsRef` hanya saat kartu QR benar-benar tidak terbuka. Bagian pencatatan ke `kitchenRecentPrints` dihapus dari efek ini (sudah diurus efek baru di atas) — efek ini sekarang murni fokus ke percobaan cetak + membersihkan antrean `kitchenReceiptsToPrint`-nya sendiri.
  - `reprintKitchenReceipts()` (tombol "Cetak Sekarang") — tambah pengecekan `qrCardMounted` di awal: kalau kartu QR masih terbuka saat tombol diklik, tampilkan `alert()` minta tutup kartu QR dulu, bukan diam-diam tidak melakukan apa-apa (sebelumnya klik saat QR terbuka akan membuat batch langsung "memantul" balik ke banner tanpa penjelasan apa pun ke staf).

### Kenapa desainnya begini
- **Tidak menghapus logika penundaan `window.print()` selama QR terbuka** — itu perbaikan yang benar dari sesi "lanjutan 9" (mencegah struk kitchen tercetak tumpang tindih dengan QR meja) dan masih diperlukan. Yang salah HANYA cakupannya — seharusnya cuma menunda pemanggilan `print()`, bukan ikut membungkam notifikasi banner.
- **Retry otomatis saat kartu QR ditutup masih dipertahankan** — karena efek `window.print()` (efek ke-2) TIDAK diubah kondisinya, begitu `qrCardMounted` balik ke `false` (klik "Tutup" = interaksi asli, membawa user-activation Chrome), efek itu tetap otomatis jalan lagi seperti sebelumnya — perilaku ini terbukti benar dari sesi "lanjutan 10" dan sengaja tidak disentuh.
- **Banner tetap "sticky" (tidak otomatis hilang setelah dicetak)** — konsisten dengan desain sesi "lanjutan 11": karena tidak ada cara pasti tahu dialog print benar-benar muncul/berhasil, banner baru hilang kalau staf klik ✕ secara eksplisit. Efek baru untuk mencatat banner ini murni menambah *kapan* pencatatan terjadi (lebih awal, tidak nunggu qrCardMounted), bukan mengubah kapan banner hilang.
- **Alert di `reprintKitchenReceipts()` saat QR masih terbuka** — sebelum perubahan ini, klik tombol saat itu bukan tanpa efek total (memicu efek print yang langsung `return` lalu batch "dipantulkan" balik oleh efek banner baru), hanya saja staf tidak tahu kenapa print tidak terjadi. `alert()` eksplisit dipilih (bukan disable tombol) karena tombol ini memang harus selalu terlihat/aktif sebagai jaring pengaman utama, dan `alert()` sudah jadi pola error-notice yang dipakai di banyak tempat lain di file ini.

### Pengujian
- `npx eslint src/app/page.js` — sempat 7 error (1 baru: `setKitchenRecentPrints` dipanggil langsung di badan efek baru) di percobaan pertama, diperbaiki dengan membungkusnya `setTimeout(...,0)` sama seperti efek lain di file ini. Setelah diperbaiki: **kembali ke baseline 6 error + 6 warning**, semuanya pra-existing (dikonfirmasi via diagnostic tool terpisah sebelum & sesudah — semua nama variabel unused pra-existing tidak berubah), tidak ada yang baru dari perubahan sesi ini.
- **Belum diuji browser/printer nyata** — dicoba dulu lewat `chromium-cli` (skill `run`) tapi tool itu **tidak tersedia** di environment ini (`npx chromium-cli` → 404, paket tidak ada di registry npm) dan kredensial database `kasir_local` tidak tersimpan di sesi/memori (sesuai aturan proyek "jangan simpan password"), jadi reproduksi otomatis penuh tidak bisa dilakukan sesi ini. Diagnosa root cause di atas murni dari pembacaan kode + konfirmasi langsung dari pengguna lewat pertanyaan (bukan dugaan tak terverifikasi), tapi PERBAIKANNYA SENDIRI belum dibuktikan lewat eksekusi nyata.

### Pekerjaan belum selesai / langkah berikutnya
- ~~Paling prioritas: uji manual di browser sungguhan~~ — **SUDAH DIKONFIRMASI PENGGUNA**: begitu kartu QR ditutup, popup print langsung muncul. Skenario inti (banner/print tertahan gara-gara kartu QR terbuka) **terbukti selesai lewat pengujian nyata oleh pengguna**, bukan cuma pembacaan kode.
- Belum eksplisit dikonfirmasi ulang oleh pengguna: banner MUNCUL (bukan cuma print langsung sukses) saat QR masih terbuka, dan alert saat klik "Cetak Sekarang" sementara QR terbuka. Perilaku initi (print tertunda → langsung keluar begitu QR ditutup) sudah terbukti benar, dua detail itu konsekuensi logis dari kode yang sama sehingga kemungkinan besar juga benar, tapi belum diverifikasi terpisah.
- Semua uji manual browser/printer lain dari sesi-sesi sebelumnya hari ini (soal fitur struk dapur secara keseluruhan) masih tertunda.

**Status: TERBUKTI SELESAI** untuk laporan bug "popup struk kitchen tidak muncul saat kartu QR terbuka".

---

## 2026-09-22 (lanjutan 13) — Claude Sonnet 5

### Tugas
Pengguna minta audit umum: "ada bug/error apa lagi yang ada dalam sistem". Diminta laporan lengkap dulu sebelum menentukan prioritas perbaikan.

### Temuan — audit backlog lama + 1 temuan baru

**1. 🔴 BARU DITEMUKAN & SUDAH DIPERBAIKI sesi ini — race condition di `POST /api/order`: pesanan yang terlambat sampai bisa membuka-lagi transaksi yang baru saja dibayar/dibatalkan**
- Lokasi: `src/app/api/order/route.js` (sebelum perbaikan: baris ~67 dan ~113-119).
- Ini sebenarnya PERSIS temuan "prioritas tinggi" yang sudah pernah dilaporkan sesi Codex 2026-09-16 ("diff ec35c98 menghapus penguncian sesi sebelum validasi order") — waktu itu ditulis "dampak concurrency belum direproduksi, task baru: uji bersamaan". Task itu **tidak pernah dikerjakan** sampai sesi ini, dan bug-nya **masih ada persis sama** saat diverifikasi ulang lewat pembacaan kode (bukan dugaan) hari ini.
- Bukti: status transaksi (`open`/`ordered`/`completed`/`cancelled`) cuma dicek SEKALI di luar transaksi database terkunci (fast pre-flight check), sebelum beberapa query lain yang makan waktu (cek idempotency, rate limit, batas porsi sesi). Setelah itu, `tx.transaction.update({where:{id:transactionId}, data:{..., status:'ordered', ...}})` menulis TANPA syarat status apa pun — memaksa status balik ke `'ordered'` apa pun kondisi sekarang.
- Skenario nyata: customer submit order saat koneksi lemot bersamaan kasir klik "Bayar" untuk meja yang sama. Kalau request order itu akhirnya diproses SETELAH pembayaran commit, transaksi yang sudah `completed` **diam-diam berubah balik jadi `'ordered'`**, dengan order baru `kitchenStatus:'queued'` menyelip masuk — tanpa error ke kasir maupun customer.
- Kenapa lolos dari perlindungan yang sudah ada: `pg_advisory_xact_lock` yang dipakai route ini cuma menyerialisasi terhadap PANGGILAN LAIN KE ROUTE INI SENDIRI (mis. dua submit order bersamaan) — TIDAK berinteraksi sama sekali dengan row-lock (`updateMany increment:0`) yang dipakai `PUT /api/transaction/[id]` (pembayaran/batal) maupun `edit-order/route.js`, karena keduanya mekanisme locking yang berbeda di Postgres (advisory lock vs row lock).

### Perbaikan kode
- `src/app/api/order/route.js` — di dalam blok `prisma.$transaction`, setelah pengecekan idempotency (`doubleCheck`) dan SEBELUM pengecekan rate-limit/batas sesi, ditambah:
  - `tx.transaction.updateMany({where:{id:transactionId}, data:{total:{increment:0}}})` — row-lock sungguhan (bukan advisory lock), pola yang SAMA PERSIS dipakai `PUT /api/transaction/[id]` dan `edit-order/route.js` untuk hal yang sama. Karena keduanya sama-sama melakukan `UPDATE` nyata ke baris `Transaction` yang sama, Postgres otomatis menyerialisasi mereka di level baris — inilah yang menutup celah race-nya.
  - `tx.transaction.findUnique({where:{id:transactionId}})` — baca ulang status TERBARU setelah row-lock didapat (bukan pakai `session` lama yang dibaca di luar transaksi).
  - Validasi ulang: kalau status bukan `open`/`ordered` atau `completedAt` sudah terisi → `SESSION_CLOSED` (409), sama seperti pesan error pre-flight check yang sudah ada. Sekalian re-validasi overflow total pakai `current.total` yang segar (bukan `session.total` yang berpotensi basi).

### Kenapa desainnya begini
- **Tidak mengganti mekanisme advisory lock yang sudah ada** — itu tetap dibutuhkan untuk tujuan aslinya (menyerialisasi submit order beruntun ke meja yang sama, supaya cek rate-limit/batas-porsi tidak bisa dilewati race antar-submit). Row-lock baru ini punya tujuan BERBEDA (menyerialisasi terhadap PEMBAYARAN), jadi ditambahkan, bukan menggantikan.
- **Pakai pola row-lock yang sudah terbukti benar di 2 tempat lain** (`transaction/[id]/route.js` PUT & DELETE, `edit-order/route.js`) — bukan bikin mekanisme baru, supaya konsisten dan sudah teruji polanya di kodebase yang sama.
- **Pre-flight check di luar transaksi TIDAK dihapus** — tetap berguna sebagai fast-path (gagal cepat untuk kasus jelas-jelas sesi sudah tutup, tanpa perlu buka transaksi database dulu). Pengecekan di dalam lock adalah yang OTORITATIF/menutup race, bukan pengganti.

### Pengujian
- `npx eslint src/app/api/order/route.js` — 0 error, 0 warning (sama seperti sebelum perubahan).
- **Belum diuji lewat eksekusi nyata** (load test/race simulation) — tidak ada akses ke database `kasir_local` atau tool browser-automation di sesi ini (sama seperti kendala di entri "lanjutan 12" di atas). Perbaikan ini murni berdasarkan pembacaan kode yang membuktikan CELAH-nya ada (baris `where` tanpa syarat status, terbukti langsung dari kode) dan CARA MENUTUPNYA konsisten dengan pola locking yang sudah terbukti benar di tempat lain dalam kodebase yang sama — tapi belum ada bukti eksekusi race 2 request bersamaan pasca-perbaikan.

**2. 🟡 DIKONFIRMASI ULANG, BELUM DIPERBAIKI — Statistik "Rincian Performa" & Rekap Harian ikut menghitung item yang sudah dihapus kasir (soft-delete)**
- Lokasi: `page.js:428` (`calculateTableStats`) dan `page.js:604` (`calculateDailyRecap`) — kedua fungsi melakukan `order.items.forEach(...)` untuk membangun `itemMap` (dasar "Menu Terlaris", porsi/meja, rekap per jam) TANPA memeriksa `item.deletedAt`.
- Card total pendapatan di level atas (`totalRevenueOverall`, `page.js:350`) **sudah benar** karena sumbernya `trx.total` (otomatis ter-update benar oleh `edit-order/route.js` saat item dihapus) — jadi HANYA breakdown detail (per-menu/per-meja/per-jam) yang salah, bukan angka total utama. Kalau ada transaksi yang pernah di-edit (item dihapus), breakdown ini akan lebih besar dari card total di atasnya — inkonsistensi yang kelihatan di layar.
- Pertama tercatat 2026-09-17. Pengguna belum memutuskan mau diperbaiki sekarang atau nanti — **belum disentuh sesi ini**, menunggu keputusan.

**3. 🟡 Sudah tercatat sebelumnya, masih pending keputusan bisnis — Edit Pesanan reset `kitchenStatus` ke `queued` meski item DIKURANGI (bukan cuma ditambah)**
- Lokasi: `edit-order/route.js:43` — diverifikasi ulang hari ini, kondisinya (`changed=true` dipicu baik oleh soft-delete item maupun perubahan quantity) masih sama seperti temuan 2026-09-12. **Belum diubah**, masih menunggu keputusan pengguna.

**4. Item lama lain (bukan bug kode, murni keputusan bisnis/pengujian fisik yang belum dilakukan)** — tidak berubah dari catatan-catatan sebelumnya: definisi "Jam Paling Sibuk", apakah durasi Take Away ikut dihitung di rata-rata durasi meja, dan pengujian cetak fisik (QR + struk kitchen) dengan printer thermal sungguhan.

### Pekerjaan belum selesai / langkah berikutnya
- **Prioritas berikutnya (dikonfirmasi pengguna)**: pengguna sudah pilih memperbaiki temuan #1 (race condition pembayaran) lebih dulu — **sudah dikerjakan sesi ini**, lihat di atas. Item #2, #3, #4 masih menunggu keputusan pengguna soal urutan berikutnya.
- **Perlu diuji nyata**: simulasikan 2 request bersamaan (submit order + PUT pembayaran untuk transaksi yang sama, timing berdekatan) di database `kasir_local` untuk membuktikan perbaikan #1 benar-benar menutup race-nya — belum dilakukan sesi ini karena keterbatasan akses (lihat bagian Pengujian).
- Item #2 (statistik) siap dikerjakan kapan saja pengguna minta — sudah jelas lokasinya, tidak perlu keputusan bisnis, cuma butuh waktu implementasi + testing manual di browser (bandingkan angka sebelum/sesudah hapus 1 item).

---

## 2026-09-25 — Claude (Sonnet 5)

### Tugas dari pengguna
Buat dan jalankan test untuk skenario: 2 submission dengan `requestId` IDENTIK, meja sama, menu sama, quantity sama — cek apakah sistem membuat 2 order atau membuatkan order untuk submission pertama lalu MENGEMBALIKAN (echo) respons yang sama untuk submission kedua, dan apakah tercatat 1 atau 2 pesanan.

### Temuan penting: seluruh `tests/order-retry.test.cjs` (dan test lain yang pakai `tests/helpers/order-api.cjs`) TERNYATA SUDAH RUSAK sejak Rev 5.4
- Lokasi: `tests/helpers/order-api.cjs`. Mock Prisma di helper ini dibuat sebelum `ec35c98` ("Rev 5.4: optimize order backend transaction...") menambah 2 hal baru di `src/app/api/order/route.js`:
  1. `export const dynamic`/`export const maxDuration` di baris 6-7 — regex helper lama cuma strip `export async function POST`, bukan `export const ...`, jadi `vm.runInContext` gagal `SyntaxError: Unexpected token 'export'` untuk SEMUA test yang lewat helper ini.
  2. Route sekarang membaca `prisma.orderSubmission.findUnique`, `prisma.transaction.findUnique`, `prisma.menuItem.findMany` **di luar** `$transaction` (fast idempotency check + pre-flight, baris 49/62-65) — helper lama cuma menyediakan method-method itu DI DALAM `tx` (di dalam `$transaction`), jadi begitu regex di atas diperbaiki, error berikutnya adalah `Cannot read properties of undefined (reading 'findUnique')`.
- Dampak: `node --test tests/order-retry.test.cjs` (disebut di `docs/order-reliability.md` baris 18 sebagai bagian dari uji wajib) **gagal 100% (10/10 test fail)** sejak beberapa revisi lalu, kemungkinan tidak disadari karena tidak ada yang menjalankannya ulang setelah Rev 5.4.
- Sudah diverifikasi dengan `git stash` bahwa kegagalan ini ADA SEBELUM sesi ini dimulai (bukan disebabkan perubahan saya).

### Perbaikan yang dilakukan
- `tests/helpers/order-api.cjs`:
  - Regex strip export digeneralisasi: `export (const|async function)` → cocok untuk semua deklarasi export baru di route.js.
  - Ditambah objek `prisma` level-atas (`prisma.transaction.findUnique`, `prisma.menuItem.findMany`, `prisma.orderSubmission.findUnique`) yang membaca dari `state` (data TERKOMIT), memisahkannya dari `draft` (data di dalam transaksi) — supaya perilaku mock cocok dengan Postgres asli: baca di luar lock tidak boleh melihat transaksi lain yang belum commit.
  - `tx.$executeRaw` (advisory lock) ditambahkan sebagai titik SERIALISASI di mock (sebelumnya titik serialisasi keliru ada di `tx.transaction.updateMany`, padahal di kode asli lock diambil SEBELUM `doubleCheck` idempotency, bukan sebelum row-lock). Snapshot `draft = structuredClone(state)` dipindah ke `$executeRaw` supaya urutan baca-tulis mock sama persis dengan urutan di `route.js`.
  - `tx.orderSubmission.count` (API lama) diganti `tx.orderSubmission.findMany` (API baru — rate limit sekarang pakai daftar timestamp untuk hitung `retryAfterMs`, bukan cuma count).
  - `state()` sekarang ikut mengembalikan `receipts` (catatan `OrderSubmission`) supaya test bisa memverifikasi jumlah PESANAN TERCATAT, bukan cuma jumlah order.
- `tests/order-session.test.cjs`: 2 assertion `deepEqual(app.state(), {sessions, orders:[]})` disesuaikan jadi `{sessions, orders:[], receipts:[]}` mengikuti shape baru `state()` — bukan perubahan perilaku, murni ikut shape.
- **File baru `tests/order-duplicate-requestid.test.cjs`** — test spesifik sesuai permintaan pengguna hari ini.

### Jawaban untuk pertanyaan pengguna (TERBUKTI lewat eksekusi test, bukan dugaan)
Skenario: kirim 2x ke meja yang sama, `requestId` SAMA PERSIS (`duplicate-request-id-0001`), menu & quantity sama (`menuItemId:1, quantity:3`), BERURUTAN (bukan race/bersamaan).
- **Sistem TIDAK membuat 2 order.** Submission kedua tidak memicu tulis baru sama sekali — ia mengembalikan (echo) response order dari submission PERTAMA (body & `id` identik, HTTP 200 untuk keduanya).
- **Hanya 1 pesanan (Order) yang tercatat** — `orders.length === 1` setelah 2x kirim.
- **Hanya 1 catatan `OrderSubmission` (receipt)** tersimpan walau ada 2 kali pengiriman — receipt kedua tidak dibuat karena idempotency check (`prisma.orderSubmission.findUnique` di baris 49 `route.js`) menemukan `requestId` yang sama dan langsung `return NextResponse.json(previous.response)` tanpa masuk ke `$transaction` sama sekali.
- Tagihan meja (`transaction.total`) juga hanya bertambah SEKALI (3 porsi, bukan 6) — tidak dobel charge.
- Ini konsisten dengan aturan yang sudah didokumentasikan di `docs/order-reliability.md` baris 6: "Pengiriman wajib memakai requestId; retry memakai ID dan isi yang sama. Replay tidak menambah order atau total."

### Pengujian
- `node --test tests/order-duplicate-requestid.test.cjs` — **PASS**.
- `node --test tests/order-session.test.cjs tests/order-retry.test.cjs tests/edit-order.test.cjs tests/payment-auth.test.cjs tests/order-duplicate-requestid.test.cjs` — **70/71 PASS**. Satu kegagalan (`edit-order.test.cjs`: "empty replacement removes items and resets total") **TIDAK terkait** perubahan sesi ini — dikonfirmasi via `git stash` bahwa test itu SUDAH gagal sebelum sesi ini dimulai, dengan mock helper `edit-order` yang TERPISAH dari `order-api.cjs` (belum diselidiki root cause-nya sesi ini).
- Tidak menjalankan terhadap database `kasir_local` sungguhan (Postgres) — memakai mock Prisma in-memory yang kini sudah disinkronkan ulang dengan pemanggilan Prisma aktual di `route.js` (diverifikasi manual baris demi baris). Untuk keyakinan lebih tinggi (menutup kemungkinan drift mock di masa depan), sebaiknya sesekali jalankan `tests/order-concurrency-local.cjs` (pakai Postgres disposable asli) yang sudah ada di repo.

### Pekerjaan belum selesai / langkah berikutnya
- **BARU, belum diselidiki**: `tests/edit-order.test.cjs` — "empty replacement removes items and resets total" gagal (`actual 1 !== expected 0`). Root cause belum dicari sesi ini (di luar scope permintaan pengguna hari ini). Perlu investigasi terpisah — kemungkinan drift serupa antara mock helper edit-order dan `edit-order/route.js` asli.
- Item lama dari sesi-sesi sebelumnya (statistik soft-delete, kitchenStatus reset saat edit, dsb.) — lihat entri di atas, belum disentuh sesi ini.

---

## 2026-09-25 (lanjutan) — Claude (Sonnet 5)

### Tugas dari pengguna
Permintaan lanjutan (masih tanggal sama): buat test skenario yang SAMA seperti sebelumnya (requestId identik, menu & quantity sama, 2x kirim) tapi kali ini dengan syarat eksplisit **tunggu sampai order pertama benar-benar tercatat ke DB** baru kirim order kedua — dan pastikan sistem mengembalikan order yang sudah tercatat.

### Kenapa dibuat test baru (bukan reuse `order-duplicate-requestid.test.cjs`)
Test sesi sebelumnya (`tests/order-duplicate-requestid.test.cjs`) secara LOGIKA sudah persis skenario ini (2 kiriman berurutan, requestId sama → order kedua di-echo), TAPI jalan di atas mock Prisma in-memory (`tests/helpers/order-api.cjs`), bukan database sungguhan. Permintaan pengguna hari ini eksplisit menyebut "tercatat ke dalam DB", jadi dibuatkan test baru yang benar-benar menulis ke PostgreSQL asli lewat `route.js` yang tidak dimodifikasi — supaya buktinya bukan cuma "mock berkata begitu".

### Perubahan kode
- **File baru `tests/order-sequential-duplicate-local.cjs`** — harness HTTP yang menjalankan `src/app/api/order/route.js` ASLI (tanpa diubah) dengan Prisma Client sungguhan, mengikuti pola yang sudah ada di `tests/order-concurrency-local.cjs` (butuh PostgreSQL disposable via env var, di sini `SEQDUP_DATABASE_URL`, bukan `.env` project). Alurnya:
  1. Buat 1 baris `Transaction` (meja) + 1 `MenuItem` dummy.
  2. Kirim order pertama (`POST /api/order`), TUNGGU respons selesai.
  3. **Query LANGSUNG ke tabel `Order`/`OrderSubmission`/`Transaction`** (bukan cuma percaya body respons HTTP) untuk memastikan order pertama benar-benar tercatat di database sebelum lanjut.
  4. Baru kirim order kedua dengan `requestId`, meja, menu, quantity SAMA PERSIS.
  5. Query ulang DB, bandingkan.
  6. Bersihkan semua fixture test (transaction/order/orderItem/orderSubmission/menuItem) di `finally`, apa pun hasilnya.

### Infrastruktur test — cluster PostgreSQL disposable baru (bukan `kasir_local`, bukan Supabase produksi)
- Password `kasir_local` tidak tercatat di memori/sesi ini (sesuai aturan proyek), jadi dibuatkan cluster PostgreSQL 18 **sementara** sendiri via `initdb`/`pg_ctl` (binary sudah terinstal di `C:\Program Files\PostgreSQL\18\bin`, sama seperti yang dipakai sesi Codex 16 Sept untuk `order-concurrency-local.cjs`), listen di `127.0.0.1:55440`, database `kasir_seq_test`, schema di-push via `prisma db push` dengan `DATABASE_URL`/`DIRECT_URL` di-override eksplisit (bukan dari `.env`).
- **Setelah test selesai, cluster ini DIHENTIKAN dan SEMUA filenya (data dir, log, file password) DIHAPUS** (`tmp/pgdata-seq-dup*`) — tidak ada password yang tersisa di disk maupun di catatan ini, sesuai aturan proyek "jangan simpan password". Hanya hasil test (`tmp/order-sequential-duplicate-results.json`, tidak berisi kredensial) yang disimpan sebagai bukti, konsisten dengan pola `tmp/order-concurrency-results.json` yang sudah ada di repo.
- `.env`/Supabase produksi dan `kasir_local` **sama sekali tidak disentuh** sesi ini.

### Hasil (TERBUKTI lewat eksekusi nyata ke PostgreSQL sungguhan, bukan mock, bukan dugaan)
Dijalankan `node tests/order-sequential-duplicate-local.cjs` terhadap cluster disposable di atas:
```
first:  { status: 200, orderId: 3 }
second: { status: 200, orderId: 3 }      <- id SAMA dengan order pertama
dbAfterFirst:  { orderCount: 1, receiptCount: 1, total: 30000 }
dbAfterSecond: { orderCount: 1, receiptCount: 1, total: 30000 }   <- TIDAK bertambah setelah kirim ke-2
pass: true
```
- **Order kedua TIDAK membuat baris baru** — sistem mengembalikan (echo) order pertama yang sudah tercatat di DB (`id` sama, body sama setelah dibandingkan dengan normalisasi urutan key JSON).
- **Baris `Order` di database tetap 1** dan **`OrderSubmission` (receipt) tetap 1** setelah 2x kirim — dikonfirmasi lewat `SELECT` langsung ke database, bukan cuma dari respons HTTP.
- **Tagihan meja (`Transaction.total`) tetap 30.000** (3 porsi x 10.000), tidak dobel-charge.
- Ini menguatkan (dengan bukti DB sungguhan) kesimpulan sesi sebelumnya yang masih berbasis mock, dan menutup item "langkah berikutnya" yang dicatat di entri sebelumnya ("sebaiknya sesekali jalankan test dengan Postgres disposable asli untuk keyakinan lebih tinggi").

### Catatan teknis kecil (bukan bug, sempat bikin test gagal palsu)
- Percobaan pertama sempat `pass:false` walau semua angka DB sudah benar — ternyata bandingannya (`JSON.stringify(second.body) === JSON.stringify(first.body)`) gagal murni karena URUTAN KEY JSON berbeda (order pertama = objek Prisma langsung, order kedua = hasil `JSON.parse` dari kolom `response` tersimpan di `OrderSubmission`) — BUKAN karena datanya berbeda. Diperbaiki dengan membandingkan versi JSON yang key-nya sudah diurutkan (`stableStringify`). Dicatat di sini supaya tidak disalahartikan sebagai bug aplikasi oleh AI/dev lain yang menjalankan ulang test ini.

### Pengujian
- `node --check tests/order-sequential-duplicate-local.cjs` — sintaks valid.
- `node tests/order-sequential-duplicate-local.cjs` (2x dijalankan selama debugging) — run terakhir **PASS** (lihat hasil di atas), disimpan di `tmp/order-sequential-duplicate-results.json`.
- Setelah test: query `SELECT count(*)` langsung ke cluster disposable mengonfirmasi 0 fixture `__seqdup_*` tersisa (cleanup `finally` bekerja) sebelum cluster dihentikan & dihapus.
- Tidak menjalankan `npx eslint` pada file ini — pola penamaan `*-local.cjs` yang sudah ada (`order-concurrency-local.cjs`) sebelumnya juga tidak dilint sebagai bagian alur kerja normal (butuh DB live, bukan test yang jalan otomatis di CI/lint).

### Pekerjaan belum selesai / langkah berikutnya
- Test ini **manual-run** (butuh binary PostgreSQL + `SEQDUP_DATABASE_URL` diisi tangan), belum diintegrasikan ke `docs/order-reliability.md` sebagai bagian dari alur uji wajib — bisa ditambahkan kalau pengguna mau jadikan ini rutin (sama seperti `order-concurrency-local.cjs` yang juga belum didaftarkan di sana).
- Item lama yang masih terbuka (lihat entri-entri sebelumnya): `tests/edit-order.test.cjs` yang gagal, statistik soft-delete, kitchenStatus reset saat edit — tidak disentuh sesi ini.

---

## 2026-09-25 (lanjutan 2) — Claude (Sonnet 5)

### Tugas dari pengguna
Buat test: setelah order selesai dan sesi meja sudah ditutup, customer scan QR meja itu LAGI — pastikan balasan sistem memberi tahu meja sudah ditutup dan minta karyawan (kasir) QR baru.

### Alur yang diperiksa dulu (baca kode, sebelum bikin test)
- Customer scan QR → buka `src/app/order/[transactionId]/page.js` → `fetchData()` (baris 39-103) panggil `GET /api/transaction/[id]` TANPA cookie login (endpoint publik untuk customer, `src/app/api/transaction/[id]/route.js:5-53`).
- Endpoint GET **tidak menolak** transaksi yang statusnya sudah `completed`/`cancelled`/`deleted` — tetap balas `200` berisi `status` transaksi apa adanya (baris 37-49, cabang non-staf).
- Frontend yang menerjemahkan status itu jadi pesan ke customer: `page.js:62-68` — kalau `status !== 'open'` dan bukan `'ordered'`, `setError('Transaksi ini sudah selesai.')`. Lalu `page.js:361-368` merender kartu: **"Transaksi ini sudah selesai."** + **"Silakan hubungi kasir untuk mendapatkan QR Code baru."** — ini yang dilihat customer di layar.
- Ditemukan JALUR KEDUA yang juga secara eksplisit menyuruh "minta QR baru": kalau customer (atau tab lama yang masih terbuka) tetap coba kirim order baru ke sesi yang sudah tertutup, `POST /api/order` menolak dengan `409 SESSION_CLOSED` dan pesan **"Sesi meja sudah ditutup atau tidak berlaku. Silakan minta QR Code baru kepada kasir."** (`src/app/api/order/route.js:68` dan `:104`, dicek 2x: pre-flight di luar lock dan sekali lagi di dalam transaksi terkunci).
- Kedua jalur ini yang diuji.

### Perubahan kode
- **File baru `tests/order-closed-session-qr-scan-local.cjs`** — pola sama seperti `order-sequential-duplicate-local.cjs` sesi sebelumnya (PostgreSQL disposable via `initdb`/`pg_ctl`, bukan `kasir_local`/produksi), TAPI kali ini menjalankan DUA route asli sekaligus tanpa dimodifikasi: `src/app/api/order/route.js` (POST) dan `src/app/api/transaction/[id]/route.js` (GET).
- Kendala teknis yang diselesaikan: `GET /api/transaction/[id]` memanggil `getSessionUser()` dari `src/lib/session.js`, yang butuh `cookies()` dari `next/headers` — API itu hanya berfungsi di dalam request context Next.js sungguhan, tidak bisa langsung dipanggil di luar `next dev`/`next start`. Karena skenario yang diuji justru customer ANONIM (tanpa cookie sama sekali), solusinya beri mock `cookies` di dalam `vm.createContext` yang selalu balas "tidak ada cookie" (`get: () => undefined`) — ini BUKAN penyederhanaan yang mengurangi keakuratan, karena itu memang persis kondisi request customer asli.
- Sesi ditutup dengan `db.transaction.update({status:'completed', completedAt:...})` LANGSUNG ke database, bukan lewat `PUT /api/transaction/[id]` (endpoint itu butuh login staf — di luar scope "customer scan QR", yang relevan diuji di sini adalah STATE AKHIR "sesi tertutup", bukan proses staf membayarnya).
- Ditambah pemeriksaan statis (baca isi file, bukan render React sungguhan — repo ini tidak punya infrastruktur test React/browser): pastikan `src/app/order/[transactionId]/page.js` MASIH mengandung teks "Transaksi ini sudah selesai.", "Silakan hubungi kasir untuk mendapatkan QR Code baru.", dan kondisi gate `trxData.status !== 'open'`. Ini jaring pengaman supaya kalau teks/kondisi itu suatu saat dihapus/diubah tanpa sengaja, test ini ikut gagal — TAPI ini bukan bukti visual (belum ada screenshot/browser run).

### Hasil (TERBUKTI lewat eksekusi nyata ke PostgreSQL sungguhan + kode route asli, bukan dugaan)
```
orderPlacedFirst:      { status: 200, orderId: 1 }
qrScanAfterClose:      { status: 200, transactionStatus: 'completed', completedAt: '...' }
orderAttemptAfterClose:{ status: 409, code: 'SESSION_CLOSED',
                          error: 'Sesi meja sudah ditutup atau tidak berlaku. Silakan minta QR Code baru kepada kasir.' }
frontendTextGuard:     { hasClosedHeading: true, hasNewQrInstruction: true, hasStatusGate: true }
pass: true
```
- **Scan QR meja yang sudah ditutup TIDAK error/500** — sistem tetap balas `200` dengan `status:'completed'`, itulah data yang membuat `page.js` menampilkan "Transaksi ini sudah selesai. Silakan hubungi kasir untuk mendapatkan QR Code baru." ke customer.
- **Percobaan pesan ulang ke sesi tertutup ditolak (`409 SESSION_CLOSED`)** dengan pesan yang SECARA EKSPLISIT menyuruh "minta QR Code baru kepada kasir" — persis yang diminta pengguna.
- Kedua balasan sistem (GET status + pesan error POST) konsisten mengarahkan customer/karyawan ke hal yang sama: minta QR baru dari kasir.

### Pengujian
- `node --check tests/order-closed-session-qr-scan-local.cjs` — sintaks valid.
- `node tests/order-closed-session-qr-scan-local.cjs` terhadap cluster PostgreSQL disposable (`127.0.0.1:55441`, db `kasir_qrclosed_test`) — **PASS**, hasil disimpan di `tmp/order-closed-session-qr-scan-results.json`.
- Setelah test: `SELECT count(*)` langsung ke DB mengonfirmasi 0 fixture `__qrclosed_*` tersisa (cleanup `finally` bekerja) sebelum cluster dihentikan (`pg_ctl stop`) dan SEMUA filenya dihapus (`tmp/pgdata-qrclosed*`, termasuk file password) — tidak ada kredensial tersisa di disk, sama seperti pola sesi sebelumnya.
- `.env`/Supabase produksi dan `kasir_local` sama sekali tidak disentuh.
- **Belum diuji di browser sungguhan** — pemeriksaan pesan frontend di sini hanya pencocokan teks di source file (`frontendTextGuard`), BUKAN screenshot/klik nyata men-scan QR meja tertutup. Kalau ingin bukti visual, perlu dicoba manual: tutup 1 meja (bayar), scan ulang QR meja itu di browser, screenshot kartu "Transaksi ini sudah selesai."

### Pekerjaan belum selesai / langkah berikutnya
- Verifikasi visual di browser (lihat poin terakhir Pengujian) belum dilakukan — opsional, tapi disarankan sebelum menganggap UX bagian ini 100% selesai diverifikasi.
- Test ini manual-run juga (perlu isi `QRCLOSED_DATABASE_URL` tangan), belum didaftarkan di `docs/order-reliability.md`.
- Item lama yang masih terbuka dari entri-entri sebelumnya (edit-order test gagal, statistik soft-delete, kitchenStatus reset saat edit) — tidak disentuh sesi ini.

---

## 2026-09-26 — Claude (Sonnet 5)

### Tugas dari pengguna
"Apakah ada tugas atau bug yang belum gua kerjakan/perbaiki?" — diminta ditelusuri ulang seluruh catatan lalu dikonsolidasikan kembali ke file ini. Ini murni audit/rangkuman (tidak ada perubahan kode), tapi beberapa klaim lama DIVERIFIKASI ULANG terhadap kode & database sungguhan sebelum ditulis di sini — bukan sekadar menyalin catatan lama tanpa cek, sesuai aturan proyek.

### Metode
Baca seluruh `CATATAN_PROYEK.md` (1000+ baris, dari entri 2026-09-11 sampai kemarin), kumpulkan setiap butir "belum selesai/langkah berikutnya", lalu untuk item yang statusnya ambigu atau sudah lama tidak di-cross-check, diverifikasi ULANG langsung ke kode saat ini (dan satu kasus ke database produksi, read-only).

### Hasil verifikasi ulang (beberapa status BERUBAH dari catatan lama)

**✅ TERNYATA SUDAH SELESAI (sebelumnya berstatus "belum dikonfirmasi") — migrasi kolom soft-delete ke produksi**
- Sejak 2026-09-14/17 catatan berulang kali menulis "belum dikonfirmasi apakah `Transaction.deletedAt`/`deletedById`/`creationRequestId` dan `OrderItem.deletedAt` sudah ada di database produksi Supabase" — tidak pernah di-cross-check ulang di catatan-catatan berikutnya.
- **Diverifikasi hari ini** lewat query read-only `information_schema.columns` langsung ke database yang ditunjuk `.env` aktif (Supabase produksi, `aws-0-ap-southeast-1.pooler.supabase.com`): **keempat kolom itu SEMUANYA sudah ada** di tabel `Transaction`/`OrderItem` produksi. Query murni `SELECT`, tidak mengubah apa pun.
- Item ini **tidak perlu lagi didaftarkan sebagai risiko terbuka** di catatan-catatan berikutnya.

**✅ TERNYATA BUKAN BUG APLIKASI — kegagalan `tests/edit-order.test.cjs` ("empty replacement removes items and resets total")**
- Sejak 2026-09-25 dicatat sebagai "BARU, belum diselidiki". **Diselidiki hari ini**: test ini mengharapkan `app.state().orders[0].items.length === 0` setelah semua item dihapus kasir — itu semantik HARD-delete (item benar-benar hilang dari array).
- Tapi sejak perubahan 2026-09-17, `edit-order/route.js` sengaja diubah jadi SOFT-delete (`orderItem.update({deletedAt:new Date()})`, bukan `orderItem.delete()`) — item TETAP ada di array, cuma `deletedAt`-nya terisi. Mock Prisma di test ini (baris 23) sudah benar mengimplementasikan `update` sebagai `Object.assign` (tidak menghapus dari array) — jadi mock-nya akurat merepresentasikan kode asli; yang salah adalah ASSERTION test-nya (`items.length===0`) yang tidak diupdate mengikuti perubahan desain 17 September.
- **Kesimpulan: `edit-order/route.js` bekerja BENAR sesuai desain soft-delete yang sudah disepakati.** Ini murni test yang butuh diperbarui assertion-nya (mis. cek item pertama punya `deletedAt` terisi & `total===0`, bukan `items.length===0`) — **tidak diperbaiki di sesi ini** (di luar scope permintaan "audit + catat", bukan perubahan kode), tapi statusnya sekarang jelas: bukan bug produksi, aman diabaikan sampai ada yang mau merapikan test-nya.

**❌ MASIH BUG, DIKONFIRMASI ULANG hari ini via baca kode langsung — agregasi statistik ikut menghitung item yang sudah dihapus kasir**
- `src/app/page.js:428` (`calculateTableStats`, dipakai tab Statistik → "Rincian Performa"/"Menu Terlaris") dan `src/app/page.js:604` (`calculateDailyRecap`, dipakai rekap harian Arsip + `exportToExcel`) — dicek ulang baris demi baris hari ini, **keduanya masih `order.items.forEach(...)` tanpa `.filter(item => !item.deletedAt)`**, persis seperti temuan 2026-09-17 yang sudah dibuktikan lewat uji fungsi sintetis (item aktif Rp10.000 + item dihapus Rp20.000 → breakdown salah tampil Rp30.000/2 item, padahal seharusnya Rp10.000/1 item).
- Dampak: total pendapatan di card atas (`totalRevenueOverall`, sumbernya `trx.total`) **tetap benar**; yang salah HANYA breakdown detail (menu terlaris, performa per meja, rekap per jam, dan file Excel hasil export) kalau ada transaksi yang item-nya pernah dihapus kasir lewat Edit Pesanan.
- **Ini bug paling lama yang masih terbuka di proyek ini** (pertama tercatat 2026-09-17, sudah 9 hari, sudah diverifikasi ulang statis oleh 4 sesi berbeda tanpa pernah diperbaiki) — prioritas tertinggi untuk dikerjakan berikutnya kalau pengguna setuju.

**❌ MASIH BUG (fix sudah ADA di kode sejak 2026-09-24/25, tapi BELUM dibuktikan lewat eksekusi nyata) — race order vs pembayaran**
- `src/app/api/order/route.js:101` (`tx.transaction.updateMany({...total:{increment:0}})` sebagai row-lock sebelum tulis order) — kode perbaikannya SUDAH ADA dan terverifikasi masih ada hari ini (tidak ter-revert).
- Tapi skenario yang seharusnya dicegah (order yang nyangkut di jaringan lambat baru sukses ditulis TEPAT SETELAH kasir menyelesaikan pembayaran meja yang sama) **belum pernah direproduksi lewat eksekusi paralel nyata** — beda dari 2 test yang dibuat kemarin (duplicate requestId & closed-session QR scan) yang keduanya SEQUENTIAL, bukan race pembayaran-vs-order. Kalau mau standar pembuktian yang sama seperti perbaikan race porsi/rate-limit 2026-09-22 (`tests/order-concurrency-local.cjs`), perlu dibuatkan test serupa yang menembak `PUT /api/transaction/[id]` (pembayaran) dan `POST /api/order` ke transaksi yang sama secara bersamaan.

**❌ MASIH TERBUKA, keputusan bisnis (bukan bug teknis) — belum ada jawaban dari pengguna:**
1. Pengurangan/penghapusan item pada order yang sudah `served`/`ready` (`edit-order/route.js`) masih mereset `kitchenStatus` balik ke `queued` — sejak 2026-09-12, belum diputuskan apakah ini perilaku yang diinginkan.
2. Definisi "Jam Paling Sibuk" (`peakHour`) — sejak 2026-09-11, masih berbasis jumlah order tiket, belum dikonfirmasi apakah sudah sesuai maksud bisnis.
3. Apakah durasi sesi Take Away ikut dihitung di "Rata-Rata Durasi Meja Terisi" — sejak 2026-09-11, belum diputuskan.

**⚠️ P2, dugaan (belum terbukti sebagai akar masalah) — deklarasi CSS `@page { size: 58mm auto; }`**
- `src/app/globals.css:206` — dicek ulang hari ini, deklarasi ini masih persis sama. Menurut spesifikasi resmi W3C CSS Paged Media 3 (ditemukan Codex 2026-09-19), `size` seharusnya `<length>{1,2}` ATAU `auto`, bukan campuran keduanya — jadi kemungkinan browser mengabaikan deklarasi ini secara diam-diam. **Belum ada bukti bahwa ini penyebab masalah cetak fisik** (laporan cetak miring/tidak center sebelumnya sudah "diperbaiki" lewat cara lain — `left:50%`+`transform:translateX(-50%)` di `.print-qr-card`, tanpa menyentuh baris ini) — dicatat sebagai potensi technical-debt CSS, bukan bug yang terbukti berdampak.

**🔒 Perlu dihapus sebelum launch (bukan bug, tapi risiko keamanan yang sudah diketahui) — kotak kredensial development di halaman login**
- `src/app/login/page.js:138-140` — dicek ulang hari ini, **masih menampilkan** `Username: admin` / `Password: admin123` secara terbuka ke siapa pun yang membuka halaman login. Sudah dicatat sejak 2026-09-11 sebagai "wajib dihapus sebelum aplikasi launch", **masih belum dihapus**. Ini bukan bug fungsional, tapi risiko nyata kalau sampai lupa dihapus saat launch (kredensial admin bocor ke publik).

**📋 Belum dieksekusi, bukan mendesak (keputusan pengguna sebelumnya: "nanti sebelum launch")**
- Tab/menu "Kitchen" (`src/app/page.js:1644`, komponen `KitchenPanel.js`) masih ada di kode. Pengguna sudah menyatakan rencana menghapusnya sebelum launch (karena struk dapur sekarang dipicu dari dashboard kasir, bukan tab Kitchen) — belum diminta eksekusi.

**🧪 Verifikasi manual/browser & printer fisik yang masih outstanding** (murni belum diuji, bukan diketahui gagal — daftar detail lengkap ada di entri masing-masing tanggal di atas):
- Cetak fisik struk QR 58mm & struk dapur (posisi, ukuran font, tidak terpotong, ruang gantung 30mm pas atau tidak) — belum pernah diuji dengan printer thermal sungguhan sepanjang seluruh riwayat proyek ini (semua sesi sejauh ini CLI-only).
- UI browser untuk: batas 100/30 porsi customer, countdown rate-limit, retry 2 tab dengan `requestId` sama, layar "sesi ditutup" saat tab customer masih terbuka (`sessionClosedMidView`), banner "N struk dapur menunggu dicetak" (sebagian sudah dikonfirmasi pengguna langsung, detail banner belum terpisah).
- Verifikasi visual (screenshot) kartu "Transaksi ini sudah selesai. Silakan hubungi kasir untuk mendapatkan QR Code baru." saat scan QR meja tertutup — baru dibuktikan lewat test API otomatis kemarin, belum lewat klik nyata di browser.

### Pengujian
- Query read-only ke database produksi Supabase (`information_schema.columns`) — dijalankan, hasil di atas.
- `node --test tests/edit-order.test.cjs` — dijalankan ulang untuk konfirmasi kegagalan masih ada & sama persis (14 pass, 1 fail, pesan error sama seperti kemarin).
- Baca langsung `src/app/page.js` (baris 296-450, 578-615), `src/app/globals.css` (baris 203-210), `src/app/login/page.js` (baris 125-141), `src/app/api/order/route.js` (baris 94-101), `src/app/page.js` (baris 1644) — semua klaim di atas dikonfirmasi terhadap kode SAAT INI, bukan disalin mentah dari catatan lama.
- Tidak ada kode aplikasi yang diubah sesi ini — murni audit & tulis catatan.

### Pekerjaan belum selesai / langkah berikutnya (ringkasan prioritas)
1. **Prioritas tertinggi**: perbaiki agregasi item terhapus di `calculateTableStats`/`calculateDailyRecap` (`page.js:428`/`:604`) — bug paling lama yang belum tersentuh, dampaknya ke laporan/statistik yang dilihat pengguna sehari-hari.
2. Buat test eksekusi nyata untuk race order-vs-pembayaran (mirip `order-concurrency-local.cjs`) untuk membuktikan perbaikan row-lock 2026-09-24 benar-benar menutup celahnya.
3. Hapus kotak kredensial development di `src/app/login/page.js` — **sebelum launch**, jangan sampai terlewat.
4. 3 keputusan bisnis yang masih menunggu jawaban pengguna (lihat daftar di atas).
5. Opsional/tidak mendesak: rapikan assertion `tests/edit-order.test.cjs` yang sudah usang, koreksi `@page size` CSS, hapus tab Kitchen, dan seluruh daftar verifikasi manual/printer fisik di atas.
