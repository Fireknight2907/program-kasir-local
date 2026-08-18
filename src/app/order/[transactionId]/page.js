"use client";

import { useState, useEffect, useRef, use } from 'react';
import { ShoppingCart, Plus, Minus, CheckCircle, Image as ImageIcon, Utensils, Search, X, ShoppingBag } from 'lucide-react';

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
  const [activeCategory, setActiveCategory] = useState('');
  const [showCartModal, setShowCartModal] = useState(false);

  const categoryRefs = useRef({});

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

        // Set initial active category
        if (menuData.length > 0) {
          const cats = [...new Set(menuData.map(item => item.category || 'Umum'))];
          if (cats.length > 0) setActiveCategory(cats[0]);
        }

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

  const getTotalItemCount = () => {
    return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  };

  const getCategoryCartCount = (categoryName) => {
    return Object.values(cart).reduce((sum, item) => {
      if ((item.category || 'Umum') === categoryName) {
        return sum + item.quantity;
      }
      return sum;
    }, 0);
  };

  const scrollToCategory = (catName) => {
    setActiveCategory(catName);
    const el = document.getElementById(`category-${catName}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
        setShowCartModal(false);
      } else {
        setError('Gagal mengirim pesanan. Silakan coba lagi.');
      }
    } catch (err) {
      setError('Terjadi kesalahan.');
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="container text-center mt-4 p-6" style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '1.1rem', opacity: 0.8 }}>Memuat menu restoran...</p>
    </div>
  );

  if (error) return (
    <div className="container text-center mt-4 p-4">
      <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
        <h2 className="text-primary">{error}</h2>
        <p className="mt-4">Silakan hubungi kasir untuk mendapatkan QR Code baru.</p>
      </div>
    </div>
  );

  if (ordered) {
    return (
      <div className="container text-center mt-4 p-4">
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <CheckCircle size={64} className="mx-auto mb-4" style={{ margin: '0 auto', display: 'block', color: '#10b981' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Pesanan Berhasil Terkirim!</h2>
          <p className="mt-2 mb-4" style={{ fontSize: '1rem', opacity: 0.8 }}>
            Terima kasih! Pesanan Anda telah masuk ke dapur dan sedang disiapkan.
          </p>
          <div style={{
            background: 'rgba(0,0,0,0.04)',
            padding: '1.25rem',
            borderRadius: '16px',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>Detail Pesanan:</p>
            <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-color)' }}>
              Nomor Meja: {transaction?.tableNumber || transactionId.split('-')[1] || '-'}
            </p>
            <p style={{ margin: '0.4rem 0', fontSize: '0.8rem', opacity: 0.7 }}>ID: <code>{transactionId}</code></p>
            <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Mohon tunggu di meja Anda.</p>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>Pembayaran dilakukan di meja kasir setelah selesai.</p>
            </div>
          </div>
          
          <button 
            className="btn btn-outline" 
            style={{ padding: '0.75rem 1.75rem', fontWeight: 600, borderRadius: '12px' }}
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
      {/* Top Header Bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--card-bg, rgba(255,255,255,0.95))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0.85rem 1rem',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Pesan Menu</h2>
            <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>Pilih makanan & minuman favorit Anda</p>
          </div>
          <span style={{
            background: '#ef4444',
            color: 'white',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            fontWeight: 800,
            fontSize: '0.85rem',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
          }}>
            MEJA {transaction?.tableNumber || transactionId.split('-')[1] || '-'}
          </span>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input
            type="text"
            className="input"
            placeholder="Cari makanan atau minuman..."
            style={{
              paddingLeft: '2.4rem',
              paddingRight: '1rem',
              paddingTop: '0.45rem',
              paddingBottom: '0.45rem',
              width: '100%',
              borderRadius: '20px',
              fontSize: '0.85rem',
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid transparent'
            }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 2-Column Body Layout */}
      <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
        {/* Left Sidebar Kategori */}
        <div style={{
          width: '95px',
          minWidth: '95px',
          background: 'rgba(0,0,0,0.02)',
          borderRight: '1px solid var(--border-color)',
          position: 'sticky',
          top: '110px',
          height: 'calc(100vh - 110px)',
          overflowY: 'auto',
          paddingBottom: '120px'
        }}>
          {categories.map(cat => {
            const count = getCategoryCartCount(cat);
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                style={{
                  width: '100%',
                  padding: '0.9rem 0.4rem',
                  border: 'none',
                  background: isActive ? 'var(--card-bg, #ffffff)' : 'transparent',
                  color: isActive ? '#ef4444' : 'var(--text-color)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderLeft: isActive ? '4px solid #ef4444' : '4px solid transparent',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  position: 'relative'
                }}
              >
                <span style={{ lineHeight: 1.2, wordBreak: 'break-word' }}>{cat}</span>
                {count > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '0.1rem 0.45rem',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    lineHeight: 1
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Panel Items */}
        <div style={{ flex: 1, padding: '0.85rem', paddingBottom: '140px', overflowY: 'auto' }}>
          {categories.map(cat => (
            <div key={cat} id={`category-${cat}`} style={{ scrollMarginTop: '120px', marginBottom: '1.25rem' }}>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: 800,
                color: 'var(--text-color)',
                marginBottom: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <Utensils size={15} style={{ color: '#ef4444' }} />
                <span>{cat}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredMenu.filter(m => (m.category || 'Umum') === cat).map(item => (
                  <div
                    key={item.id}
                    className="glass-card"
                    style={{
                      padding: '0.65rem',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      background: 'var(--card-bg, #ffffff)',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      opacity: item.isAvailable === false ? 0.6 : 1
                    }}
                  >
                    {/* Menu Thumbnail */}
                    <div style={{
                      width: '75px',
                      height: '75px',
                      minWidth: '75px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ color: '#cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <ImageIcon size={24} />
                        </div>
                      )}
                    </div>

                    {/* Menu Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.name}
                      </h4>
                      <p style={{ margin: '0.15rem 0 0.35rem 0', fontSize: '0.72rem', opacity: 0.6 }}>
                        Terjual 0
                      </p>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ef4444' }}>
                        Rp {item.price.toLocaleString('id-ID')}
                        <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.7, color: 'var(--text-color)' }}> /porsi</span>
                      </div>
                    </div>

                    {/* Stepper Button */}
                    <div style={{ paddingLeft: '0.25rem' }}>
                      {item.isAvailable === false ? (
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.3rem 0.5rem', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                          Stok Habis
                        </div>
                      ) : cart[item.id] ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'rgba(239, 68, 68, 0.06)',
                          padding: '0.2rem 0.35rem',
                          borderRadius: '16px',
                          border: '1px solid #ef4444'
                        }}>
                          <button
                            onClick={() => updateCart(item, -1)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Minus size={13} />
                          </button>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', minWidth: '16px', textAlign: 'center', color: '#ef4444' }}>
                            {cart[item.id].quantity}
                          </span>
                          <button
                            onClick={() => updateCart(item, 1)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateCart(item, 1)}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          <Plus size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Bottom Cart Bar */}
      {getTotalItemCount() > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '12px',
          left: '12px',
          right: '12px',
          zIndex: 90,
          background: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(16px)',
          borderRadius: '24px',
          padding: '0.65rem 1rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'white'
        }}>
          {/* Cart Icon & Info */}
          <div 
            className="flex items-center gap-3" 
            style={{ cursor: 'pointer' }}
            onClick={() => setShowCartModal(true)}
          >
            <div style={{
              position: 'relative',
              background: '#ef4444',
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
            }}>
              <ShoppingCart size={20} color="white" />
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ffffff',
                color: '#ef4444',
                fontSize: '0.7rem',
                fontWeight: 900,
                borderRadius: '10px',
                padding: '0.1rem 0.4rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                {getTotalItemCount()}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Total Pesanan ({getTotalItemCount()} item)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                Rp {getCartTotal().toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={submitOrder}
            disabled={submitting}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '18px',
              padding: '0.65rem 1.25rem',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
            }}
          >
            {submitting ? 'Mengirim...' : 'Kirim Pesanan'}
          </button>
        </div>
      )}

      {/* Cart Detail Modal */}
      {showCartModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            width: '100%',
            maxWidth: '600px',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            padding: '1.25rem',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.3)'
          }}>
            <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <ShoppingBag size={20} style={{ color: '#ef4444' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Detail Keranjang Pesanan</h3>
              </div>
              <button 
                onClick={() => setShowCartModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              {Object.values(cart).map(item => (
                <div key={item.id} className="flex justify-between items-center p-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>{item.name}</h4>
                    <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700 }}>
                      Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'rgba(239, 68, 68, 0.06)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '16px',
                    border: '1px solid #ef4444'
                  }}>
                    <button
                      onClick={() => updateCart(item, -1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', minWidth: '20px', textAlign: 'center', color: '#ef4444' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCart(item, 1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <div className="flex justify-between items-center mb-3">
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total Pembayaran:</span>
                <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#ef4444' }}>
                  Rp {getCartTotal().toLocaleString('id-ID')}
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={submitOrder}
                disabled={submitting}
                style={{ width: '100%', padding: '0.85rem', borderRadius: '16px', fontWeight: 800, background: '#ef4444', borderColor: '#ef4444' }}
              >
                {submitting ? 'Mengirim...' : 'Kirim Pesanan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
