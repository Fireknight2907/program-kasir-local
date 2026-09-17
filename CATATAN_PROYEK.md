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
