import Link from 'next/link';
import { QrCode, ShieldCheck } from 'lucide-react';

export default function OrderIndexPage() {
  return (
    <div className="flex justify-center items-center" style={{ minHeight: '75vh' }}>
      <div className="glass-card text-center" style={{ maxWidth: '540px', width: '100%', padding: '2.5rem 2rem' }}>
        <div style={{
          display: 'inline-flex',
          padding: '1.2rem',
          borderRadius: '50%',
          background: 'rgba(99,102,241,0.15)',
          color: 'var(--primary-color)',
          marginBottom: '1rem'
        }}>
          <QrCode size={48} />
        </div>
        <h2 className="text-primary">Pemesanan Pelanggan</h2>
        <p className="mt-4 mb-4" style={{ fontSize: '1rem', lineHeight: '1.6', opacity: 0.9 }}>
          Untuk memesan makanan dan minuman, silakan <strong>Scan QR Code Pesanan</strong> yang telah dibuat oleh Kasir di meja Anda.
        </p>

        <div className="flex flex-col gap-3 mt-4">
          <Link href="/login" className="btn btn-primary">
            <ShieldCheck size={18} style={{ marginRight: '8px' }} /> Masuk ke Dashboard Admin / Kasir
          </Link>
        </div>
      </div>
    </div>
  );
}
