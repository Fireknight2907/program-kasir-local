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
