# Pengiriman pesanan dan batas trial

- Maksimal 10 porsi per menu, 30 per kiriman, 100 per sesi, 5 kiriman baru per menit per sesi.
- Batas berlaku pada API order, termasuk takeaway langsung. Kasir dapat menangani pesanan besar lewat edit pesanan yang memerlukan login staf.
- Baris menu duplikat digabung sebelum validasi. Harga tetap dari database.
- Pengiriman wajib memakai requestId; retry memakai ID dan isi yang sama. Replay tidak menambah order atau total, termasuk setelah sesi ditutup atau order diedit.
- Catatan OrderSubmission disimpan atomik bersama order. Jangan hapus catatan ini selama QR/sesi masih mungkin digunakan.
- Browser menyimpan payload belum pasti di localStorage sebelum mengirim. Setelah refresh, gunakan Cek / Kirim Ulang. Jangan ganti tab/perangkat atau hapus penyimpanan untuk mengulang pesanan yang belum pasti.
- ID berbeda berarti pesanan baru yang disengaja; sistem tidak menebak berdasarkan kesamaan menu. Batas sesi dan frekuensi tetap berlaku.
- Proteksi membatasi penyalahgunaan, bukan memastikan identitas setiap pelanggan. Kitchen tetap perlu proses penerimaan pesanan.

## Menyiapkan database lingkungan lain

Jalankan SQL additive prisma/sql/order-submission.sql melalui Prisma db execute --schema prisma/schema.prisma --file prisma/sql/order-submission.sql, lalu prisma generate dan restart server. Jangan gunakan reset database. SQL telah diterapkan ke database yang dikonfigurasi aplikasi lokal ini pada 8 September 2026.

## Uji

node --test tests/order-session.test.cjs tests/order-retry.test.cjs tests/edit-order.test.cjs tests/payment-auth.test.cjs

Uji manual: kirim order, putus koneksi respons, refresh, cek pengiriman yang sama; jumlah order dan tagihan harus tetap satu kali. Pengiriman 1000 porsi ditolak tanpa order baru.
