"use client";

import { useState, useEffect, use } from 'react';
import { ShoppingCart, Plus, Minus, CheckCircle } from 'lucide-react';

export default function OrderPage({ params }) {
  const { transactionId } = use(params);
  
  const [menu, setMenu] = useState([]);
  const [transaction, setTransaction] = useState(null);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [error, setError] = useState('');

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

  if (loading) return <div className="container text-center mt-4"><p>Memuat menu...</p></div>;
  if (error) return <div className="container text-center mt-4"><div className="glass-card"><h2 className="text-primary">{error}</h2></div></div>;
  
  if (ordered) {
    return (
      <div className="container text-center mt-4">
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <CheckCircle size={64} className="text-primary mx-auto mb-4" style={{ margin: '0 auto', display: 'block', color: 'var(--secondary-color)' }} />
          <h2>Pesanan Berhasil Diterima!</h2>
          <p>Terima kasih! Pesanan Anda sedang disiapkan.</p>
          <p>Silakan menuju kasir untuk melakukan pembayaran.</p>
        </div>
      </div>
    );
  }

  const categories = [...new Set(menu.map(item => item.category))];

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div className="header-bar text-center justify-center">
        <div>
          <h2>Menu Kasir Pintar</h2>
          <p>Pilih makanan dan minuman yang ingin Anda pesan</p>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat} className="mb-4">
          <h3 style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', borderRadius: '8px', display: 'inline-block' }}>{cat}</h3>
          <div className="grid grid-cols-3 mt-4">
            {menu.filter(m => m.category === cat).map(item => (
              <div key={item.id} className="glass-card flex flex-col justify-between">
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>{item.name}</h3>
                  <p className="text-primary" style={{ fontWeight: 600, fontSize: '1.2rem' }}>
                    Rp {item.price.toLocaleString('id-ID')}
                  </p>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  {cart[item.id] ? (
                    <div className="flex items-center gap-2" style={{ width: '100%', justifyContent: 'space-between', background: 'rgba(0,0,0,0.05)', padding: '0.2rem', borderRadius: '8px' }}>
                      <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }} onClick={() => updateCart(item, -1)}><Minus size={16} /></button>
                      <span style={{ fontWeight: 600 }}>{cart[item.id].quantity}</span>
                      <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => updateCart(item, 1)}><Plus size={16} /></button>
                    </div>
                  ) : (
                    <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => updateCart(item, 1)}>
                      Tambah
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {Object.keys(cart).length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--card-bg)',
          backdropFilter: 'blur(12px)',
          borderTop: 'var(--glass-border)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
          padding: '1rem 2rem',
          zIndex: 100
        }}>
          <div className="container" style={{ padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Total Pesanan ({Object.values(cart).reduce((a, b) => a + b.quantity, 0)} item)</p>
              <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Rp {getCartTotal().toLocaleString('id-ID')}</h3>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={submitOrder}
              disabled={submitting}
            >
              {submitting ? 'Memproses...' : (
                <>
                  <ShoppingCart size={18} style={{ marginRight: '8px' }} /> Kirim Pesanan
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
