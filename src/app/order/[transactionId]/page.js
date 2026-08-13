"use client";

import { useState, useEffect, use } from 'react';
import { ShoppingCart, Plus, Minus, CheckCircle, Image as ImageIcon, Utensils, Search } from 'lucide-react';
import Link from 'next/link';

export default function OrderPage({ params }) {
  const { transactionId } = use(params);

  const [menu, setMenu] = useState([]);
  const [transaction, setTransaction] = useState(null);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes, trxRes] = await Promise.all([
          fetch('/api/menu'),
          fetch(`/api/transaction/${transactionId}`)
        ]);

        if (!trxRes.ok) {
          setError('Transaksi tidak ditemukan atau sudah tidak berlaku.');
          setLoading(false);
          return;
        }

        const trxData = await trxRes.json();

        if (trxData.status !== 'open') {
          if (trxData.status === 'ordered') {
            setOrdered(true);
          } else {
            setError('Transaksi ini sudah selesai.');
          }
        }

        setTransaction(trxData);

        const menuData = await menuRes.json();
        setMenu(menuData);

      } catch (err) {
        setError('Terjadi kesalahan saat memuat data.');
      }
      setLoading(false);
    };

    fetchData();
  }, [transactionId]);

  const updateCart = (item, delta) => {
    setCart(prev => {
      const currentQty = prev[item.id]?.quantity || 0;
      const newQty = Math.max(0, currentQty + delta);

      const newCart = { ...prev };
      if (newQty === 0) {
        delete newCart[item.id];
      } else {
        newCart[item.id] = { ...item, quantity: newQty };
      }
      return newCart;
    });
  };

  const getCartTotal = () => {
    return Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const submitOrder = async () => {
    if (Object.keys(cart).length === 0) return;

    setSubmitting(true);
    try {
      const items = Object.values(cart).map(item => ({
        menuItemId: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, items })
      });

      if (res.ok) {
        setOrdered(true);
      } else {
        setError('Gagal mengirim pesanan. Silakan coba lagi.');
      }
    } catch (err) {
      setError('Terjadi kesalahan.');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="container text-center mt-4"><p>Memuat menu restoran...</p></div>;
  if (error) return (
    <div className="container text-center mt-4">
      <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h2 className="text-primary">{error}</h2>
        <p className="mt-4">Silakan hubungi kasir untuk mendapatkan QR Code baru.</p>
      </div>
    </div>
  );

  if (ordered) {
    return (
      <div className="container text-center mt-4">
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 2rem' }}>
          <CheckCircle size={72} className="mx-auto mb-4" style={{ margin: '0 auto', display: 'block', color: 'var(--secondary-color)' }} />
          <h2>Pesanan Berhasil Terkirim!</h2>
          <p className="mt-2 mb-4" style={{ fontSize: '1.1rem' }}>
            Terima kasih! Pesanan Anda telah masuk ke dapur dan sedang disiapkan.
          </p>
          <div style={{
            background: 'rgba(0,0,0,0.05)',
            padding: '1.5rem',
            borderRadius: '16px',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Detail Pesanan:</p>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-color)' }}>
              Nomor Meja: {transaction?.tableNumber || transactionId.split('-')[1] || '-'}
            </p>
            <p style={{ margin: '0.5rem 0', fontSize: '0.85rem', opacity: 0.8 }}>ID: <code>{transactionId}</code></p>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Mohon tunggu di meja Anda.</p>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>Pembayaran dilakukan di meja kasir setelah selesai.</p>
            </div>
          </div>
          
          <button 
            className="btn btn-outline" 
            style={{ padding: '0.8rem 2rem', fontWeight: 600 }}
            onClick={() => {
              setOrdered(false);
              setCart({});
            }}
          >
            <Plus size={18} style={{ display: 'inline', marginRight: '8px' }} />
            Pesan Lagi (Tambahan)
          </button>
        </div>
      </div>
    );
  }

  const filteredMenu = menu.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const categories = [...new Set(filteredMenu.map(item => item.category || 'Umum'))];

  return (
    <div style={{ paddingBottom: '120px' }}>
      {/* Top Header Bar for User */}
      <div className="header-bar flex justify-between items-center flex-wrap gap-4" style={{ padding: '1.5rem', background: 'var(--card-bg)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: '0 0 24px 24px', marginBottom: '2rem' }}>
        <div style={{ width: '100%' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Menu Restoran</h2>
            <span style={{
              background: 'var(--primary-color)',
              color: 'white',
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              fontWeight: 800,
              fontSize: '1.1rem',
              boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
            }}>
              MEJA {transaction?.tableNumber || transactionId.split('-')[1] || '-'}
            </span>
          </div>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '0.95rem' }}>Pilih hidangan favorit Anda untuk memesan langsung dari meja ini</p>
        </div>
        
        {/* Search Bar */}
        <div style={{ width: '100%', position: 'relative', marginTop: '0.5rem' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, color: 'var(--text-color)' }} />
          <input
            type="text"
            className="input"
            placeholder="Cari makanan atau minuman..."
            style={{ paddingLeft: '2.5rem', width: '100%', borderRadius: '12px', background: 'rgba(255,255,255,0.8)' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="container" style={{ padding: '0 1rem' }}>
      {/* Menu Categories & Grid */}
      {categories.map(cat => (
        <div key={cat} className="mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Utensils size={20} className="text-primary" />
            <h3 style={{
              margin: 0,
              padding: '0.4rem 1rem',
              background: 'var(--primary-color)',
              color: 'white',
              borderRadius: '20px',
              fontSize: '1rem',
              fontWeight: 600
            }}>
              {cat}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '1rem' }}>
            {filteredMenu.filter(m => (m.category || 'Umum') === cat).map(item => (
              <div key={item.id} className="glass-card flex flex-col justify-between" style={{ overflow: 'hidden', padding: 0, borderRadius: '16px' }}>
                {/* Image Section */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#f8fafc', padding: '1rem' }}>
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center" style={{ height: '100%', color: '#94a3b8' }}>
                      <ImageIcon size={48} />
                      <span style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>Foto Menu</span>
                    </div>
                  )}
                </div>

                <div style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>{item.name}</h3>
                  <p className="text-primary" style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: 0 }}>
                    Rp {item.price.toLocaleString('id-ID')}
                  </p>
                </div>

                <div style={{ padding: '0 1.25rem 1.25rem 1.25rem' }}>
                  {cart[item.id] ? (
                    <div className="flex items-center gap-2" style={{
                      width: '100%',
                      justify: 'space-between',
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid var(--primary-color)',
                      padding: '0.3rem 0.5rem',
                      borderRadius: '8px'
                    }}>
                      <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', border: 'none' }} onClick={() => updateCart(item, -1)}>
                        <Minus size={16} />
                      </button>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary-color)' }}>
                        {cart[item.id].quantity}
                      </span>
                      <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => updateCart(item, 1)}>
                        <Plus size={16} />
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => updateCart(item, 1)}>
                      <Plus size={16} style={{ marginRight: '6px' }} /> Tambah Pesanan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>

      {/* Floating Bottom Cart Bar */}
      {Object.keys(cart).length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--card-bg)',
          backdropFilter: 'blur(16px)',
          borderTop: 'var(--glass-border)',
          boxShadow: '0 -6px 24px rgba(0,0,0,0.15)',
          padding: '1rem 2rem',
          zIndex: 100
        }}>
          <div className="container" style={{ padding: 0, display: 'flex', justifyContent: 'space-between', items: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
                Total Pesanan ({Object.values(cart).reduce((a, b) => a + b.quantity, 0)} item)
              </p>
              <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.4rem', fontWeight: 800 }}>
                Rp {getCartTotal().toLocaleString('id-ID')}
              </h3>
            </div>
            <button
              className="btn btn-primary"
              onClick={submitOrder}
              disabled={submitting}
              style={{ padding: '0.8rem 1.8rem', fontSize: '1.05rem' }}
            >
              {submitting ? 'Mengirim...' : (
                <>
                  <ShoppingCart size={20} style={{ marginRight: '8px' }} /> Kirim Pesanan Sekarang
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
