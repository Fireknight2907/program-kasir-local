"use client";

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, RefreshCcw, Check, Printer } from 'lucide-react';

export default function CashierDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeQr, setActiveQr] = useState(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transaction');
      const data = await res.json();
      setTransactions(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 5000); // Poll every 5s for new orders
    return () => clearInterval(interval);
  }, []);

  const generateNewTransaction = async () => {
    try {
      const res = await fetch('/api/transaction', { method: 'POST' });
      const data = await res.json();
      const orderUrl = `${window.location.origin}/order/${data.id}`;
      setActiveQr({ id: data.id, url: orderUrl });
      fetchTransactions();
    } catch (e) {
      console.error(e);
    }
  };

  const completeTransaction = async (id) => {
    try {
      await fetch(`/api/transaction/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      fetchTransactions();
    } catch (e) {
      console.error(e);
    }
  };

  const printQR = () => {
    window.print();
  };

  return (
    <div>
      <div className="header-bar">
        <div>
          <h1>Kasir Pintar</h1>
          <p>Kelola pesanan dan transaksi dengan mudah</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-outline" onClick={fetchTransactions}>
            <RefreshCcw size={18} className="mr-2" style={{ marginRight: '8px' }} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={generateNewTransaction}>
            <Plus size={18} className="mr-2" style={{ marginRight: '8px' }} /> Buat QR Pesanan
          </button>
        </div>
      </div>

      {activeQr && (
        <div className="glass-card mb-4 flex flex-col items-center">
          <h2>QR Code Pesanan Baru</h2>
          <p>Scan QR ini untuk memesan atau kunjungi link secara manual.</p>
          <div className="qr-container mt-4 mb-4">
            <QRCodeSVG value={activeQr.url} size={256} />
          </div>
          <div className="flex gap-4">
            <button className="btn btn-outline" onClick={() => setActiveQr(null)}>Tutup</button>
            <button className="btn btn-secondary" onClick={printQR}>
              <Printer size={18} style={{ marginRight: '8px' }} /> Cetak QR
            </button>
          </div>
        </div>
      )}

      <h2 className="mt-4 mb-4">Daftar Transaksi</h2>
      {loading && transactions.length === 0 ? (
        <p>Memuat data transaksi...</p>
      ) : (
        <div className="grid grid-cols-2">
          {transactions.map(trx => (
            <div key={trx.id} className="glass-card flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3>ID: {trx.id.substring(0, 8)}...</h3>
                  <span className={`badge badge-${trx.status}`}>
                    {trx.status === 'open' ? 'Menunggu Pesanan' : trx.status === 'ordered' ? 'Perlu Dibayar' : 'Selesai'}
                  </span>
                </div>
                <p>Waktu: {new Date(trx.createdAt).toLocaleString('id-ID')}</p>
                
                {trx.orders && trx.orders.length > 0 ? (
                  <div className="mt-4">
                    <p style={{ fontWeight: 600 }}>Daftar Pesanan:</p>
                    <ul style={{ paddingLeft: '1rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                      {trx.orders.map(order => 
                        order.items.map(item => (
                          <li key={item.id}>
                            {item.quantity}x {item.menuItem.name} 
                            <span style={{ float: 'right' }}>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                          </li>
                        ))
                      )}
                    </ul>
                    <div className="flex justify-between items-center mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 600, fontSize: '1.2rem' }}>Total:</span>
                      <span className="text-primary" style={{ fontWeight: 800, fontSize: '1.4rem' }}>
                        Rp {trx.total.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4" style={{ fontStyle: 'italic', opacity: 0.7 }}>Belum ada pesanan.</p>
                )}
              </div>
              
              {trx.status === 'ordered' && (
                <button 
                  className="btn btn-secondary mt-4"
                  onClick={() => completeTransaction(trx.id)}
                  style={{ width: '100%' }}
                >
                  <Check size={18} style={{ marginRight: '8px' }} /> Tandai Selesai (Sudah Dibayar)
                </button>
              )}
            </div>
          ))}
          {transactions.length === 0 && !loading && (
            <p>Belum ada transaksi hari ini.</p>
          )}
        </div>
      )}
    </div>
  );
}
