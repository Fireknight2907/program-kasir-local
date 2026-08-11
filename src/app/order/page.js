import Link from 'next/link';

export default function OrderIndexPage() {
  return (
    <div className="container text-center mt-4">
      <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 className="text-primary">Halaman Pemesanan</h2>
        <p className="mt-4 mb-4">
          Untuk melakukan pemesanan, silakan <strong>Scan QR Code</strong> yang telah disediakan oleh kasir pada meja Anda atau perangkat kasir.
        </p>
        <Link href="/" className="btn btn-outline mt-4">
          Kembali ke Dashboard Kasir
        </Link>
      </div>
    </div>
  );
}
