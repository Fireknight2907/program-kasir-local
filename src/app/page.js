"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus, RefreshCcw, Check, Printer, LogOut, Utensils,
  Receipt, Image as ImageIcon, Trash2, Edit3, Upload, X, Search
} from 'lucide-react';

export default function CashierDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'menu'

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [activeQr, setActiveQr] = useState(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [inputTableNumber, setInputTableNumber] = useState('');
  const [tableModalError, setTableModalError] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);

  // Menu management state
  const [menuList, setMenuList] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuSearch, setMenuSearch] = useState('');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form state for add/edit menu
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'Makanan',
    image: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Check auth status on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setCurrentUser(data.user);
      } catch (err) {
        router.push('/login');
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, [router]);

  // Fetch transactions
  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await fetch('/api/transaction');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransactions(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingTransactions(false);
  };

  // Fetch menu items
  const fetchMenu = async () => {
    setLoadingMenu(true);
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      if (Array.isArray(data)) {
        setMenuList(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingMenu(false);
  };

  useEffect(() => {
    if (!checkingAuth && currentUser) {
      fetchTransactions();
      fetchMenu();
      const interval = setInterval(fetchTransactions, 5000);
      return () => clearInterval(interval);
    }
  }, [checkingAuth, currentUser]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/me', { method: 'DELETE' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const openTableModal = () => {
    setInputTableNumber('');
    setTableModalError('');
    setShowTableModal(true);
  };

  const handleCreateTransactionWithTable = async (e) => {
    e.preventDefault();
    if (!inputTableNumber.trim()) {
      setTableModalError('Nomor meja wajib diisi.');
      return;
    }

    setGeneratingQr(true);
    setTableModalError('');
    try {
      const res = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber: inputTableNumber.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        const orderUrl = `${window.location.origin}/order/${data.id}`;
        setActiveQr({
          id: data.id,
          tableNumber: data.tableNumber || inputTableNumber.trim(),
          url: orderUrl
        });
        setShowTableModal(false);
        fetchTransactions();
      } else {
        setTableModalError(data.error || 'Gagal membuat QR pesanan.');
      }
    } catch (e) {
      console.error(e);
      setTableModalError('Terjadi kesalahan server.');
    }
    setGeneratingQr(false);
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

  // Image Upload handler for PNG
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate client-side that file is PNG
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      setFormError('File gambar harus berformat PNG (.png).');
      return;
    }

    setUploadingImage(true);
    setFormError('');
    try {
      const body = new FormData();
      body.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body,
      });

      const data = await res.json();
      if (res.ok) {
        setFormData(prev => ({ ...prev, image: data.url }));
      } else {
        setFormError(data.error || 'Gagal mengunggah foto PNG.');
      }
    } catch (err) {
      setFormError('Terjadi kesalahan saat unggah foto PNG.');
    }
    setUploadingImage(false);
  };

  // Open Modal for Add/Edit
  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name: '', price: '', category: 'Makanan', image: '' });
    setFormError('');
    setShowMenuModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      category: item.category || 'Makanan',
      image: item.image || '',
    });
    setFormError('');
    setShowMenuModal(true);
  };

  const handleSaveMenu = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name || !formData.price) {
      setFormError('Nama dan harga menu wajib diisi.');
      return;
    }

    setFormSubmitting(true);
    try {
      const url = editingItem ? `/api/menu/${editingItem.id}` : '/api/menu';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          price: parseInt(formData.price),
          category: formData.category,
          image: formData.image,
        }),
      });

      if (res.ok) {
        setShowMenuModal(false);
        fetchMenu();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Gagal menyimpan menu.');
      }
    } catch (err) {
      setFormError('Terjadi kesalahan server.');
    }
    setFormSubmitting(false);
  };

  const handleDeleteMenu = async (id, name) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus menu "${name}"?`)) return;

    try {
      const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMenu();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus menu.');
      }
    } catch (err) {
      alert('Terjadi kesalahan server.');
    }
  };

  if (checkingAuth) {
    return (
      <div className="container text-center mt-4">
        <p>Memeriksa sesi login admin...</p>
      </div>
    );
  }

  const filteredMenu = menuList.filter(item =>
    item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(menuSearch.toLowerCase()))
  );

  return (
    <div>
      {/* Top Header Bar */}
      <div className="header-bar">
        <div>
          <h1>Kasir Pintar <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary-color)', background: 'rgba(99,102,241,0.1)', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>Admin Mode</span></h1>
          <p>Kelola pesanan transaksi & daftar menu makanan/minuman</p>
        </div>
        <div className="flex items-center gap-4">
          <div style={{ fontSize: '0.9rem', textAlign: 'right', display: 'none', smDisplay: 'block' }}>
            <span style={{ fontWeight: 600, display: 'block' }}>{currentUser?.name || 'Admin'}</span>
            <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>Role: {currentUser?.role || 'ADMIN'}</span>
          </div>
          <button className="btn btn-danger" onClick={handleLogout} title="Keluar dari sistem admin">
            <LogOut size={18} style={{ marginRight: '6px' }} /> Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button
          className={`btn ${activeTab === 'transactions' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('transactions')}
        >
          <Receipt size={18} style={{ marginRight: '8px' }} /> Transaksi & QR Code
        </button>
        <button
          className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('menu')}
        >
          <Utensils size={18} style={{ marginRight: '8px' }} /> Kelola Menu & Foto
        </button>
      </div>

      {/* TAB 1: TRANSAKSI & QR */}
      {activeTab === 'transactions' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2>Daftar Transaksi Realtime</h2>
            <div className="flex gap-4">
              <button className="btn btn-outline" onClick={fetchTransactions}>
                <RefreshCcw size={18} style={{ marginRight: '8px' }} /> Refresh
              </button>
              <button className="btn btn-primary" onClick={openTableModal}>
                <Plus size={18} style={{ marginRight: '8px' }} /> Buat QR Pesanan Baru
              </button>
            </div>
          </div>

          {activeQr && (
            <div className="glass-card print-qr-card mb-4 flex flex-col items-center text-center" style={{ border: '2px solid var(--primary-color)' }}>
              <div style={{
                background: 'var(--primary-color)',
                color: 'white',
                padding: '0.4rem 1.2rem',
                borderRadius: '20px',
                fontWeight: 800,
                fontSize: '1.25rem',
                marginBottom: '0.75rem',
                display: 'inline-block'
              }}>
                MEJA {activeQr.tableNumber}
              </div>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>QR Code Pesanan Meja {activeQr.tableNumber}</h2>
              <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>Scan QR Code di bawah untuk melihat menu & melakukan pemesanan makanan/minuman.</p>
              
              <div className="qr-container mt-2 mb-2">
                <QRCodeSVG value={activeQr.url} size={220} />
              </div>
              
              <p style={{ fontSize: '0.85rem', wordBreak: 'break-all', opacity: 0.8, maxWidth: '450px', marginTop: '0.5rem' }}>
                Kode Transaksi: <code>{activeQr.id}</code>
              </p>
              <p className="no-print" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                URL: <a href={activeQr.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>{activeQr.url}</a>
              </p>

              <div className="flex gap-4 mt-4 no-print">
                <button className="btn btn-outline" onClick={() => setActiveQr(null)}>Tutup</button>
                <button className="btn btn-secondary" onClick={printQR}>
                  <Printer size={18} style={{ marginRight: '8px' }} /> Cetak QR Code Meja
                </button>
              </div>
            </div>
          )}

          {loadingTransactions && transactions.length === 0 ? (
            <p>Memuat data transaksi...</p>
          ) : (
            <div className="grid grid-cols-2">
              {transactions.map(trx => (
                <div key={trx.id} className="glass-card flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span style={{
                          background: 'var(--primary-color)',
                          color: 'white',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}>
                          MEJA {trx.tableNumber || trx.id.split('-')[1] || '-'}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>ID: {trx.id.substring(0, 16)}...</h3>
                      </div>
                      <span className={`badge badge-${trx.status}`}>
                        {trx.status === 'open' ? 'Menunggu Pesanan' : trx.status === 'ordered' ? 'Perlu Dibayar' : 'Selesai'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem' }}>Waktu: {new Date(trx.createdAt).toLocaleString('id-ID')}</p>

                    {trx.orders && trx.orders.length > 0 ? (
                      <div className="mt-4">
                        <p style={{ fontWeight: 600 }}>Daftar Pesanan:</p>
                        <ul style={{ paddingLeft: '1rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                          {trx.orders.map(order =>
                            order.items.map(item => (
                              <li key={item.id} style={{ marginBottom: '0.25rem' }}>
                                {item.quantity}x {item.menuItem?.name || 'Item'}
                                <span style={{ float: 'right' }}>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                              </li>
                            ))
                          )}
                        </ul>
                        <div className="flex justify-between items-center mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Total:</span>
                          <span className="text-primary" style={{ fontWeight: 800, fontSize: '1.3rem' }}>
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
              {transactions.length === 0 && !loadingTransactions && (
                <p>Belum ada transaksi hari ini.</p>
              )}
            </div>
          )}

          {/* Modal Dialog Input Nomor Meja */}
          {showTableModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-color)', position: 'relative' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3>Input Nomor Meja Customer</h3>
                  <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowTableModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                {tableModalError && (
                  <div style={{
                    padding: '0.6rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    marginBottom: '1rem'
                  }}>
                    {tableModalError}
                  </div>
                )}

                <form onSubmit={handleCreateTransactionWithTable} className="flex flex-col gap-4">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Nomor Meja Pelanggan *
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Contoh: 05, 12, A1..."
                      value={inputTableNumber}
                      onChange={(e) => setInputTableNumber(e.target.value)}
                      autoFocus
                      required
                    />
                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.4rem' }}>
                      Nomor meja ini akan digunakan sebagai ID unik transaksi dan dicetak pada QR Code.
                    </p>
                  </div>

                  <div className="flex gap-4 justify-between mt-2">
                    <button type="button" className="btn btn-outline" style={{ width: '40%' }} onClick={() => setShowTableModal(false)}>
                      Batal
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ width: '60%' }} disabled={generatingQr}>
                      {generatingQr ? 'Membuat QR...' : 'Buat & Cetak QR'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: KELOLA MENU & FOTO */}
      {activeTab === 'menu' && (
        <div>
          <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <h2>Daftar Menu Restauran</h2>
            <div className="flex gap-4 items-center" style={{ flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: '240px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Cari nama/kategori menu..."
                  style={{ paddingLeft: '2.5rem' }}
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={openAddModal}>
                <Plus size={18} style={{ marginRight: '8px' }} /> Tambah Menu Baru
              </button>
            </div>
          </div>

          {loadingMenu ? (
            <p>Memuat daftar menu...</p>
          ) : (
            <div className="grid grid-cols-3">
              {filteredMenu.map(item => (
                <div key={item.id} className="glass-card flex flex-col justify-between" style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ position: 'relative', width: '100%', height: '180px', background: '#e2e8f0' }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center" style={{ height: '100%', color: '#94a3b8' }}>
                        <ImageIcon size={48} />
                        <span style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>Tanpa Foto</span>
                      </div>
                    )}
                    <span style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(0,0,0,0.65)',
                      color: 'white',
                      backdropFilter: 'blur(4px)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {item.category || 'Umum'}
                    </span>
                  </div>

                  <div style={{ padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>{item.name}</h3>
                    <p className="text-primary" style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: 0 }}>
                      Rp {item.price.toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="flex gap-2" style={{ padding: '0 1.25rem 1.25rem 1.25rem' }}>
                    <button className="btn btn-outline" style={{ flex: 1, padding: '0.4rem' }} onClick={() => openEditModal(item)}>
                      <Edit3 size={16} style={{ marginRight: '6px' }} /> Edit
                    </button>
                    <button className="btn btn-danger" style={{ padding: '0.4rem 0.75rem' }} onClick={() => handleDeleteMenu(item.id, item.name)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {filteredMenu.length === 0 && (
                <p>Menu tidak ditemukan.</p>
              )}
            </div>
          )}

          {/* Modal Form Tambah/Edit Menu */}
          {showMenuModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-color)', position: 'relative' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3>{editingItem ? 'Edit Menu' : 'Tambah Menu Baru'}</h3>
                  <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowMenuModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                {formError && (
                  <div style={{
                    padding: '0.6rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    marginBottom: '1rem'
                  }}>
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSaveMenu} className="flex flex-col gap-4">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Nama Makanan / Minuman *
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Contoh: Es Teh Manis"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        Harga (Rp) *
                      </label>
                      <input
                        type="number"
                        className="input"
                        placeholder="15000"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        Kategori
                      </label>
                      <select
                        className="input"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="Makanan">Makanan</option>
                        <option value="Minuman">Minuman</option>
                        <option value="Dessert">Dessert</option>
                        <option value="Tambahan">Tambahan</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Upload Foto Gambar Menu (.PNG)
                    </label>

                    <div style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '12px',
                      padding: '1.5rem 1rem',
                      textAlign: 'center',
                      background: 'rgba(0,0,0,0.02)',
                      transition: 'border-color 0.2s ease'
                    }}>
                      {formData.image ? (
                        <div className="flex flex-col items-center">
                          <div style={{ position: 'relative', width: '100%', maxHeight: '160px', borderRadius: '8px', overflow: 'hidden', marginBottom: '0.75rem', border: '1px solid var(--border-color)' }}>
                            <img src={formData.image} alt="Preview PNG" style={{ width: '100%', maxHeight: '160px', objectFit: 'contain', background: '#f8fafc' }} />
                          </div>
                          <div className="flex gap-2">
                            <label className="btn btn-outline" style={{ cursor: 'pointer', fontSize: '0.85rem', padding: '0.3rem 0.8rem' }}>
                              <Upload size={14} style={{ marginRight: '6px' }} /> Ganti Foto PNG
                              <input
                                type="file"
                                accept="image/png"
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                                disabled={uploadingImage}
                              />
                            </label>
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem' }}
                              onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                            >
                              Hapus Foto
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <ImageIcon size={36} className="text-primary mb-2" style={{ opacity: 0.6 }} />
                          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Pilih File Foto PNG</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem' }}>Hanya mendukung format file .png</p>
                          
                          <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '0.5rem 1.2rem', fontSize: '0.9rem' }}>
                            <Upload size={16} style={{ marginRight: '6px' }} />
                            {uploadingImage ? 'Mengunggah...' : 'Pilih Gambar PNG'}
                            <input
                              type="file"
                              accept="image/png"
                              style={{ display: 'none' }}
                              onChange={handleFileUpload}
                              disabled={uploadingImage}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 justify-between mt-4">
                    <button type="button" className="btn btn-outline" style={{ width: '50%' }} onClick={() => setShowMenuModal(false)}>
                      Batal
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ width: '50%' }} disabled={formSubmitting}>
                      {formSubmitting ? 'Menyimpan...' : (editingItem ? 'Simpan Perubahan' : 'Tambah Menu')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
