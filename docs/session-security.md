# Konfigurasi sesi staf

Sesi login memakai tanda tangan HMAC-SHA256 dengan SESSION_SECRET. Role dan profil selalu dibaca ulang dari database. Sesi berlaku 24 jam; perubahan password atau penghapusan akun membuat sesi sebelumnya tidak valid. Cookie JSON dari versi lama ditolak sehingga staf perlu login ulang.

## Lokal

SESSION_SECRET sudah dibuat di .env.local yang diabaikan Git. Jangan commit, tampilkan, atau bagikan nilainya. Jika konfigurasi lingkungan berubah, restart server lokal bila Next.js belum memuatnya.

## Deployment

Sebelum deploy, buat SESSION_SECRET acak baru minimal 32 karakter di pengaturan environment server hosting. Gunakan nilai yang sama untuk semua instance deployment. Jangan gunakan prefix NEXT_PUBLIC_. Kunci lokal tidak ikut push. Tanpa kunci yang valid, pembuatan/verifikasi sesi bertanda tangan gagal tertutup. Rotasi kunci membuat staf perlu login ulang.

## Perilaku

- Tanpa sesi valid: endpoint staf mengembalikan 401.
- Role selain ADMIN/KASIR: endpoint transaksi mengembalikan 403.
- Pengelolaan akun tetap mengikuti aturan admin/pemilik akun, memakai sesi terverifikasi.
- Menu pelanggan, kategori, pengiriman order, dan pembacaan transaksi QR tetap tersedia untuk pelanggan.
- Pembayaran merupakan konfirmasi manual staf; ini bukan verifikasi otomatis penerimaan uang dari bank/QRIS.
- Sesi memakai cookie HttpOnly, SameSite=Lax, dan Secure di production HTTPS.

## Pengujian

Jalankan node --test tests/order-session.test.cjs tests/edit-order.test.cjs tests/payment-auth.test.cjs. Tes memakai data tiruan, bukan database restoran.
