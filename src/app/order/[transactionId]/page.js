"use client";

import { useState, useEffect, useRef, use } from 'react';
import { ShoppingCart, Plus, Minus, CheckCircle, Image as ImageIcon, Utensils, Search, X, ShoppingBag, Clock, ChevronUp, ChevronDown } from 'lucide-react';

import { ORDER_LIMITS } from '@/lib/order-limits';
import { newOrderRequestId } from '@/lib/order-request';

export default function OrderPage({ params }) {
  const { transactionId } = use(params);

  const [connectionError, setConnectionError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [menu, setMenu] = useState([]);
  const [transaction, setTransaction] = useState(null);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const pendingRef = useRef(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [submitMessage, setSubmitMessage] = useState('');
  const storageKey = 'pending-order:' + transactionId;
  const [ordered, setOrdered] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [showCartModal, setShowCartModal] = useState(false);
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [showExistingOrders, setShowExistingOrders] = useState(false);

  const [categoriesList, setCategoriesList] = useState([]);
  const [rateLimitedUntil, setRateLimitedUntil] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const categoryRefs = useRef({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (saved?.transactionId === transactionId && saved.requestId && Array.isArray(saved.items)) {
          pendingRef.current = saved;
          setPendingOrder(saved);
        }
      } catch { /* Sending is blocked later if durable storage is unavailable. */ }
      try {
        const [menuRes, trxRes, catRes] = await Promise.all([
          fetch('/api/menu'),
          fetch(`/api/transaction/${transactionId}`),
          fetch('/api/categories')
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

        let catData = [];
        if (catRes && catRes.ok) {
          catData = await catRes.json();
          setCategoriesList(catData);
        }

        // Set initial active category
        if (menuData.length > 0) {
          const catMap = {};
          if (Array.isArray(catData)) {
            catData.forEach((c, i) => { catMap[c.name] = c.order !== undefined ? c.order : i; });
          }
          const cats = [...new Set(menuData.map(item => item.category || 'Umum'))].sort((a, b) => {
            const orderA = catMap[a] !== undefined ? catMap[a] : 999;
            const orderB = catMap[b] !== undefined ? catMap[b] : 999;
            if (orderA !== orderB) return orderA - orderB;
            return a.localeCompare(b);
          });
          if (cats.length > 0) setActiveCategory(cats[0]);
        }

      } catch (err) {
        setError('Terjadi kesalahan saat memuat data.');
      }
      setLoading(false);
    };

    fetchData();
  }, [transactionId]);

  useEffect(() => {
    let stopped = false, busy = false;
    async function refreshStatus() {
      if (busy) return; busy = true;
      try {
        const res = await fetch('/api/transaction/' + transactionId, {cache:'no-store',signal:AbortSignal.timeout(10000)});
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!stopped) { setTransaction(data); setConnectionError(''); setLastUpdated(new Date()); }
      } catch { if (!stopped) setConnectionError('Koneksi terputus. Status terakhir mungkin belum terbaru; hubungi staf jika perlu.'); }
      finally { busy = false; }
    }
    const timer = setInterval(refreshStatus, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [transactionId]);

  // Live countdown for the "5 kiriman/menit" rate limit — ticks every second from the
  // retryAfterMs the server returns (based on when the oldest recent submission ages out).
  // setState calls happen inside the interval callback (deferred), never synchronously in the
  // effect body, so this doesn't trigger cascading renders.
  useEffect(() => {
    if (!rateLimitedUntil) return;
    const timer = setInterval(() => {
      const current = Date.now();
      if (current >= rateLimitedUntil) setRateLimitedUntil(null);
      else setNow(current);
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitedUntil]);
  const rateLimitSecondsLeft = rateLimitedUntil ? Math.max(0, Math.ceil((rateLimitedUntil - now) / 1000)) : 0;

  const getAggregatedTotalItemCount = () => {
    if (!transaction?.orders || !Array.isArray(transaction.orders)) return 0;
    return transaction.orders.reduce((sum, order) => sum + (order.items || []).reduce((s, item) => s + (Number(item.quantity) || 0), 0), 0);
  };
  const sessionLimitReached = getAggregatedTotalItemCount() >= ORDER_LIMITS.perSession;

  const formatCountdown = (seconds) => {
    if (seconds >= 60) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return s > 0 ? `${m} menit ${s} detik` : `${m} menit`;
    }
    return `${seconds} detik`;
  };

  const updateCart = (item, delta) => {
    if (submittingRef.current || pendingRef.current || sessionLimitReached) return;
    setCart(prev => {
      const currentQty = prev[item.id]?.quantity || 0;
      const newQty = Math.max(0, Math.min(ORDER_LIMITS.perMenu, currentQty + delta));
      const currentTotal = Object.values(prev).reduce((sum, value) => sum + value.quantity, 0);
      if (currentTotal - currentQty + newQty > ORDER_LIMITS.perSubmission) return prev;

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

  const getAggregatedOrderedItems = () => {
    if (!transaction || !transaction.orders || !Array.isArray(transaction.orders)) {
      return { ordersList: [], totalItemCount: 0, totalAmount: 0 };
    }
    
    let totalItemCount = 0;
    let totalAmount = 0;
    const ordersList = [];

    transaction.orders.forEach((order, idx) => {
      if (order.items && Array.isArray(order.items)) {
        const items = order.items.map(item => {
          const qty = Number(item.quantity) || 0;
          const prc = Number(item.price) || 0;
          const tot = qty * prc;
          totalItemCount += qty;
          totalAmount += tot;
          return {
            id: item.id,
            name: item.menuItem?.name || 'Item Tidak Dikenal',
            quantity: qty,
            price: prc,
            totalPrice: tot
          };
        });

        ordersList.push({
          orderId: order.id,
          orderNumber: idx + 1,
          createdAt: order.createdAt,
          isTakeaway: order.isTakeaway,
          items
        });
      }
    });

    return { ordersList, totalItemCount, totalAmount };
  };

  const submitOrder = async () => {
    if (submittingRef.current) return;
    if (!pendingRef.current && !['open', 'ordered'].includes(transaction?.status)) { setSubmitMessage('Sesi sudah ditutup. Hubungi kasir untuk sesi baru.'); return; }
    const items = Object.values(cart).map(item => ({ menuItemId: item.id, quantity: item.quantity }));
    if (!pendingRef.current && !items.length) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitMessage('');
    try {
      const payload = pendingRef.current || { transactionId, requestId: newOrderRequestId(), items, isTakeaway };
      // Persist BEFORE sending as safety net.
      localStorage.setItem(storageKey, JSON.stringify(payload));
      pendingRef.current = payload;
      // Only setPendingOrder if we were already in pending state (retrying)
      if (pendingOrder) setPendingOrder(payload);

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000), // generous timeout for serverless
      });
      const response = await res.json().catch(() => ({}));
      if (res.ok) {
        localStorage.removeItem(storageKey);
        pendingRef.current = null;
        setPendingOrder(null);
        setCart({});
        setError('');
        setOrdered(true);
        setShowCartModal(false);
        try {
          const trxRes = await fetch('/api/transaction/' + transactionId, { cache: 'no-store' });
          if (trxRes.ok) setTransaction(await trxRes.json());
        } catch { /* Receipt confirmed; refreshing the bill can be retried by reload. */ }
      } else if (res.status >= 500) {
        setPendingOrder(payload);
        setSubmitMessage(response?.error || 'Menghubungi server... Akan dicoba ulang otomatis.');
      } else {
        // A definite rejection created no order; allow fixing the cart.
        localStorage.removeItem(storageKey);
        pendingRef.current = null;
        setPendingOrder(null);
        if (response?.code === 'RATE_LIMIT') {
          const retryMs = Number(response.retryAfterMs) > 0 ? Number(response.retryAfterMs) : 60000;
          setRateLimitedUntil(Date.now() + retryMs);
        } else {
          setSubmitMessage(response?.error || 'Pesanan ditolak. Periksa pesanan Anda.');
        }
        if (response?.code === 'SESSION_CLOSED') setError(response?.error);
      }
    } catch (err) {
      // Timeout or network drop — enter pendingOrder mode for auto-retry
      setPendingOrder(pendingRef.current);
      setSubmitMessage('Koneksi lambat atau terputus. Sedang mencoba ulang otomatis...');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Auto-retry every 8 s while stuck in pendingOrder state.
  // The requestId is idempotent so retrying is always safe.
  const autoRetryRef = useRef(null);
  useEffect(() => {
    if (!pendingOrder) {
      if (autoRetryRef.current) { clearInterval(autoRetryRef.current); autoRetryRef.current = null; }
      return;
    }
    if (autoRetryRef.current) return; // already running
    // Kick off first retry after 4 s, then every 8 s
    const first = setTimeout(() => { submitOrder(); }, 4000);
    autoRetryRef.current = setInterval(() => { submitOrder(); }, 8000);
    return () => { clearTimeout(first); clearInterval(autoRetryRef.current); autoRetryRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrder]);

  if (pendingOrder) return (
    <div className="container text-center p-6">
      <h2>{submitting ? 'Memeriksa pengiriman...' : 'Pengiriman belum dikonfirmasi'}</h2>
      <p style={{ marginBottom: 16 }}>
        {submitMessage || 'Ada pengiriman yang sedang diverifikasi. Halaman akan otomatis lanjut setelah terkonfirmasi.'}
      </p>
      {/* Spinning indicator while checking */}
      {submitting && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <svg style={{ animation: 'spin 1s linear infinite', width: 22, height: 22 }} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <span style={{ opacity: 0.7, fontSize: '.9rem' }}>Sedang memeriksa...</span>
        </div>
      )}
      {/* Disable button while submitting to prevent double-send */}
      <button className="btn btn-primary" disabled={submitting} onClick={submitOrder} style={{ opacity: submitting ? 0.6 : 1 }}>
        {submitting ? 'Memeriksa...' : 'Cek / Kirim Ulang'}
      </button>
      <p style={{ marginTop: 16, fontSize: '.85rem', opacity: 0.7 }}>Jangan membuat pesanan baru dari tab lain untuk menggantikan pengiriman ini. Jika tetap bermasalah, hubungi kasir.</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

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
    const { ordersList, totalItemCount, totalAmount } = getAggregatedOrderedItems();
    const grandTotal = transaction?.total || totalAmount;

    return (
      <div className="container text-center mt-4 p-4 mb-8">
        <div className="glass-card" style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem 1.5rem', textAlign: 'center', borderRadius: '20px' }}>
          <CheckCircle size={64} className="mx-auto mb-3" style={{ margin: '0 auto', display: 'block', color: '#10b981' }} />
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Pesanan Berhasil Terkirim!</h2>
          <p className="mt-1 mb-4" style={{ fontSize: '0.95rem', opacity: 0.8 }}>
            Pesanan tersimpan. Penerimaan dan proses memasak dikonfirmasi oleh kitchen.
          </p>

          <div role={connectionError?'alert':'status'} style={{fontSize:'.85rem',marginBottom:16,color:connectionError?'#dc2626':'inherit'}}>{connectionError || (lastUpdated ? 'Diperbarui ' + lastUpdated.toLocaleTimeString('id-ID') : 'Status diperbarui otomatis setiap 5 detik.')}</div>
          <div style={{textAlign:'left',marginBottom:16}}>{transaction?.orders?.filter(order => order.items?.length).map(order => <p key={order.id}><strong>Pesanan #{order.id}:</strong> {{queued:'Menunggu diterima kitchen',accepted:'Diterima kitchen',preparing:'Sedang dimasak',ready:'Siap disajikan',served:'Sudah disajikan',cancelled:'Dibatalkan'}[order.kitchenStatus] || 'Menunggu konfirmasi kitchen'}</p>)}</div>
          {/* Header Info Box */}
          <div style={{
            background: 'rgba(0,0,0,0.03)',
            padding: '1.25rem',
            borderRadius: '16px',
            marginBottom: '1.25rem',
            textAlign: 'center',
            border: '1px solid var(--border-color)'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '0.2rem', fontSize: '0.85rem', opacity: 0.7 }}>Detail Lokasi & Transaksi:</p>
            <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-color)' }}>
              {transaction?.tableNumber?.toLowerCase().includes('take away') ? transaction.tableNumber : `Meja: ${transaction?.tableNumber || transactionId.split('-')[1] || '-'}`}
            </p>
            
            <div style={{
              fontSize: '0.82rem',
              background: 'rgba(255,255,255,0.8)',
              padding: '0.6rem 0.8rem',
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              textAlign: 'left',
              marginTop: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <span><strong>Waktu Order:</strong> {transaction?.createdAt ? new Date(transaction.createdAt).toLocaleString('id-ID') : '-'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} style={{ color: transaction?.completedAt || transaction?.status === 'completed' ? '#10b981' : '#f59e0b', flexShrink: 0 }} />
                <span>
                  <strong>Status pembayaran:</strong> {transaction?.status === 'completed' ? 'Lunas · sesi ditutup' : transaction?.status === 'cancelled' ? 'Sesi dibatalkan' : 'Belum dibayar'}
                </span>
              </div>
            </div>
          </div>

          {/* Rincian Menu Yang Sudah Dipesan */}
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem',
            textAlign: 'left',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <Utensils size={20} style={{ color: 'var(--primary-color)' }} />
              Daftar Menu Yang Dipesan ({totalItemCount} Item)
            </h3>

            {ordersList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {ordersList.map((ord, oIdx) => (
                  <div key={ord.orderId || oIdx} style={{ background: 'rgba(0,0,0,0.02)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                        Pesanan #{ord.orderNumber}
                      </span>
                      {ord.isTakeaway && (
                        <span style={{ fontSize: '0.7rem', background: '#f59e0b', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                          Take Away (Bungkus)
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {ord.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ background: 'var(--primary-color)', color: 'white', padding: '2px 7px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800 }}>
                              {item.quantity}x
                            </span>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                          </div>
                          <span style={{ fontWeight: 700, opacity: 0.9 }}>
                            Rp {item.totalPrice.toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Grand Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '2px dashed var(--border-color)', marginTop: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Total Tagihan:</span>
                  <span style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--primary-color)' }}>
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            ) : (
              <p style={{ fontStyle: 'italic', opacity: 0.7, margin: 0 }}>Belum ada rincian item pesanan.</p>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem', background: 'rgba(59, 130, 246, 0.08)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#1d4ed8' }}>
              Silakan tunggu di meja Anda. Pembayaran dilakukan di kasir setelah selesai.
            </p>
          </div>
          
          {sessionLimitReached && ['open', 'ordered'].includes(transaction?.status) && (
            <div style={{ marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.08)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#b91c1c' }}>
                Pesanan sudah melewati {ORDER_LIMITS.perSession} porsi. Panggil karyawan jika ingin menambah pesanan.
              </p>
            </div>
          )}

          <button
            className="btn btn-outline"
            disabled={sessionLimitReached}
            style={{ padding: '0.75rem 1.75rem', fontWeight: 700, borderRadius: '14px', width: '100%', fontSize: '0.95rem', opacity: sessionLimitReached ? 0.6 : 1 }}
            onClick={() => {
              if (!['open', 'ordered'].includes(transaction?.status) || sessionLimitReached) return;
              setOrdered(false);
              setCart({});
            }}
          >
            <Plus size={18} style={{ display: 'inline', marginRight: '8px' }} />
            {!['open', 'ordered'].includes(transaction?.status) ? 'Sesi sudah ditutup' : sessionLimitReached ? `Batas ${ORDER_LIMITS.perSession} Porsi Tercapai` : 'Pesan Menu Tambahan'}
          </button>
        </div>
      </div>
    );
  }

  const filteredMenu = menu.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const categoryOrderMap = {};
  if (Array.isArray(categoriesList) && categoriesList.length > 0) {
    categoriesList.forEach((c, i) => {
      categoryOrderMap[c.name] = c.order !== undefined ? c.order : i;
    });
  }

  const categories = [...new Set(filteredMenu.map(item => item.category || 'Umum'))].sort((a, b) => {
    const orderA = categoryOrderMap[a] !== undefined ? categoryOrderMap[a] : 999;
    const orderB = categoryOrderMap[b] !== undefined ? categoryOrderMap[b] : 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
      {(connectionError || !['open', 'ordered'].includes(transaction?.status)) && <p role="alert" style={{padding:16,background:'#fef3c7',color:'#92400e'}}>{!['open', 'ordered'].includes(transaction?.status) ? 'Sesi sudah ditutup. Minta QR baru kepada kasir untuk memesan kembali.' : connectionError}</p>}

      {sessionLimitReached && (
        <p role="alert" style={{ padding: 16, background: '#fee2e2', color: '#991b1b', fontWeight: 700, textAlign: 'center' }}>
          Pesanan sudah melewati {ORDER_LIMITS.perSession} porsi. Panggil karyawan jika ingin menambah pesanan.
        </p>
      )}

      <p role="status" style={{ padding: '0.75rem', textAlign: 'center' }}>Maksimal {ORDER_LIMITS.perMenu} porsi per menu, {ORDER_LIMITS.perSubmission} porsi per kiriman, {ORDER_LIMITS.perSession} porsi per sesi, dan {ORDER_LIMITS.perMinute} kiriman per menit. Pesanan lebih besar: hubungi kasir.</p>
      {rateLimitSecondsLeft > 0
        ? <p role="alert" style={{ padding: '0.75rem', textAlign: 'center', color: '#b91c1c', fontWeight: 700 }}>Terlalu banyak pengiriman. Coba lagi setelah {formatCountdown(rateLimitSecondsLeft)}.</p>
        : submitMessage && <p role="alert" style={{ padding: '0.75rem', textAlign: 'center', color: '#b91c1c' }}>{submitMessage}</p>}
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

      {/* Banner / Summary Pesanan Yang Sudah Dipesan Sebelumnya */}
      {(() => {
        const { ordersList, totalItemCount, totalAmount } = getAggregatedOrderedItems();
        if (totalItemCount === 0) return null;
        return (
          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
            padding: '0.65rem 1rem'
          }}>
            <div
              onClick={() => setShowExistingOrders(!showExistingOrders)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} style={{ color: '#2563eb' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1d4ed8' }}>
                  Sudah Dipesan: {totalItemCount} item (Rp {totalAmount.toLocaleString('id-ID')})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>
                <span>{showExistingOrders ? 'Sembunyikan' : 'Lihat Rincian'}</span>
                {showExistingOrders ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {showExistingOrders && (
              <div style={{
                marginTop: '0.65rem',
                paddingTop: '0.65rem',
                borderTop: '1px solid rgba(59, 130, 246, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                fontSize: '0.85rem'
              }}>
                {ordersList.map((ord, idx) => (
                  <div key={ord.orderId || idx} style={{ background: 'rgba(255,255,255,0.7)', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.7, marginBottom: '2px' }}>
                      Pesanan #{ord.orderNumber} {ord.isTakeaway ? '(Take Away)' : ''}
                    </div>
                    {ord.items.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                        <span>{item.quantity}x {item.name}</span>
                        <span style={{ fontWeight: 600 }}>Rp {item.totalPrice.toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

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
            onClick={() => setShowCartModal(true)}
            disabled={submitting || sessionLimitReached}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '18px',
              padding: '0.65rem 1.25rem',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              opacity: sessionLimitReached ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
            }}
          >
            {submitting ? 'Loading...' : sessionLimitReached ? 'Batas Tercapai' : 'Confirm Order'}
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
                style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  color: '#ef4444', 
                  border: 'none', 
                  cursor: 'pointer', 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}
              >
                <X size={20} />
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
              <div style={{ marginBottom: '0.8rem', background: 'rgba(0,0,0,0.03)', padding: '0.65rem', borderRadius: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)' }}>
                  <input 
                    type="checkbox" 
                    checked={isTakeaway} 
                    onChange={(e) => setIsTakeaway(e.target.checked)} 
                    style={{ width: '18px', height: '18px', accentColor: '#ef4444' }} 
                  />
                  Pesanan ini ingin dibungkus (Take Away)
                </label>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total Pembayaran:</span>
                <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#ef4444' }}>
                  Rp {getCartTotal().toLocaleString('id-ID')}
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={submitOrder}
                disabled={submitting || sessionLimitReached || rateLimitSecondsLeft > 0}
                style={{ width: '100%', padding: '0.85rem', borderRadius: '16px', fontWeight: 800, background: '#ef4444', borderColor: '#ef4444', opacity: (sessionLimitReached || rateLimitSecondsLeft > 0) ? 0.6 : 1 }}
              >
                {submitting ? 'Mengirim...' : rateLimitSecondsLeft > 0 ? `Tunggu ${formatCountdown(rateLimitSecondsLeft)}` : sessionLimitReached ? `Batas ${ORDER_LIMITS.perSession} Porsi Tercapai` : 'Kirim Pesanan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
