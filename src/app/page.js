"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus, RefreshCcw, Check, Printer, LogOut, Utensils,
  Receipt, Image as ImageIcon, Trash2, Edit3, Upload, X, Search, QrCode, Users, Key, User, ChevronDown, ChevronUp, Sliders, FileText, Download, Calendar, Clock, GripVertical, CheckCircle, BarChart3, TrendingUp, Timer, Award, ShoppingBag, ShoppingCart, Minus, Banknote, Smartphone, CreditCard, Flame, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Filter
} from 'lucide-react';

export default function CashierDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'menu'

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [activeQr, setActiveQr] = useState(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [inputTableNumber, setInputTableNumber] = useState('');
  const [tableModalError, setTableModalError] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);
  const [isTakeAway, setIsTakeAway] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState('');

  // Edit Order state
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingOrderItems, setEditingOrderItems] = useState([]);
  const [editOrderSearch, setEditOrderSearch] = useState('');

  // Archive state
  const [archiveTransactions, setArchiveTransactions] = useState([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [archiveDate, setArchiveDate] = useState('');

  // Statistics state
  const [statsTransactions, setStatsTransactions] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsDate, setStatsDate] = useState('');

  // Direct Takeaway state
  const [showDirectTakeawayModal, setShowDirectTakeawayModal] = useState(false);
  const [takeawayCustomerName, setTakeawayCustomerName] = useState('');
  const [takeawayCart, setTakeawayCart] = useState({});
  const [takeawaySearch, setTakeawaySearch] = useState('');
  const [submittingTakeaway, setSubmittingTakeaway] = useState(false);
  const [takeawayError, setTakeawayError] = useState('');

  // Payment Close Order Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTransaction, setPaymentTransaction] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('CASH');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Statistics sub-tab state ('tables' | 'items' | 'hourly')
  const [statsSubTab, setStatsSubTab] = useState('tables');
  const [statsItemSearch, setStatsItemSearch] = useState('');
  const [statsItemCategory, setStatsItemCategory] = useState('ALL');
  const [statsItemSort, setStatsItemSort] = useState('desc'); // 'desc': Paling Laku -> Tidak Laku, 'asc': Paling Tidak Laku -> Laku
  const [selectedHourFilter, setSelectedHourFilter] = useState('ALL');

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
  const [customCategories, setCustomCategories] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Category management state
  const [categoriesList, setCategoriesList] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryModalError, setCategoryModalError] = useState('');
  const [draggedCategoryIdx, setDraggedCategoryIdx] = useState(null);
  const [touchDraggingIdx, setTouchDraggingIdx] = useState(null);
  const categoryListRef = useRef(null);

  // Employee Management State (Admin only)
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [employeeFormData, setEmployeeFormData] = useState({ username: '', password: '', name: '', ttl: '', phone: '', address: '' });
  const [employeeError, setEmployeeError] = useState('');

  // Change Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');

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

  const getLocalDateString = (date) => {
    const d = date ? new Date(date) : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateTimeIndonesian = (dateInput) => {
    if (!dateInput) return { day: '-', date: '-', time: '-' };
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return { day: '-', date: '-', time: '-' };

    const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds} WIB`;

    return {
      day: dayName,
      date: dateStr,
      time: timeStr
    };
  };

  useEffect(() => {
    if (!archiveDate) {
      setArchiveDate(getLocalDateString());
    }
  }, [archiveDate]);

  // Fetch transactions for today
  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const today = getLocalDateString();
      const res = await fetch(`/api/transaction?date=${today}&tab=active`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransactions(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingTransactions(false);
  };

  // Fetch archive transactions
  const fetchArchive = async () => {
    setLoadingArchive(true);
    try {
      const dateToFetch = archiveDate || getLocalDateString();
      const res = await fetch(`/api/transaction?date=${dateToFetch}&tab=archive`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setArchiveTransactions(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingArchive(false);
  };

  // Fetch statistics transactions
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const dateToFetch = statsDate || getLocalDateString();
      const res = await fetch(`/api/transaction?date=${dateToFetch}&tab=archive`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setStatsTransactions(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingStats(false);
  };

  // Format duration helper (in minutes/hours)
  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return '-';
    const totalMinutes = Math.round(ms / (1000 * 60));
    if (totalMinutes < 1) return '< 1 mnt';
    if (totalMinutes < 60) return `${totalMinutes} mnt`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} j ${minutes} mnt` : `${hours} j`;
  // Calculate Table & Item Statistics
  const calculateTableStats = () => {
    const validTrxs = statsTransactions.filter(trx => trx.status === 'completed');
    let totalRevenueOverall = 0;
    let totalTurnoverCount = validTrxs.length;
    let totalDurationMsOverall = 0;
    let durationCountOverall = 0;

    let totalOrdersReceived = 0;
    let initialOrdersCount = 0;
    let additionalOrdersCount = 0;

    const tableMap = {};
    const itemMap = {};

    // Initialize itemMap with all items from menuList so unsold menu items (0 porsi) are included
    if (menuList && Array.isArray(menuList)) {
      menuList.forEach(m => {
        itemMap[m.name] = {
          id: m.id,
          name: m.name,
          category: m.category || 'Lainnya',
          quantity: 0,
          orderCount: 0,
          totalRevenue: 0,
          unitPrice: m.price,
          image: m.image || null,
        };
      });
    }

    const paymentMethods = {
      CASH: { count: 0, revenue: 0 },
      QRIS: { count: 0, revenue: 0 },
      CARD: { count: 0, revenue: 0 },
      UNSPECIFIED: { count: 0, revenue: 0 }
    };

    // Hourly Stats calculation (00:00 - 23:00)
    const hourlyMap = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = {
        hour: h,
        label: `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`,
        shortLabel: `Jam ${String(h).padStart(2, '0')}:00`,
        orderCount: 0,
        totalItemsQuantity: 0,
        totalRevenue: 0,
        tableSet: new Set(),
        itemsMap: {},
        tablesMap: {},
      };
    }

    validTrxs.forEach(trx => {
      const rev = Number(trx.total) || 0;
      totalRevenueOverall += rev;

      const pm = trx.paymentMethod || 'UNSPECIFIED';
      if (paymentMethods[pm]) {
        paymentMethods[pm].count += 1;
        paymentMethods[pm].revenue += rev;
      } else {
        paymentMethods.UNSPECIFIED.count += 1;
        paymentMethods.UNSPECIFIED.revenue += rev;
      }

      let rawTable = trx.tableNumber ? String(trx.tableNumber).trim() : '0';
      const isTakeAway = rawTable.toLowerCase().startsWith('take away');
      const tableLabel = isTakeAway ? rawTable : `Meja ${rawTable}`;

      if (!tableMap[rawTable]) {
        tableMap[rawTable] = {
          tableKey: rawTable,
          label: tableLabel,
          isTakeAway,
          turnoverCount: 0,
          totalRevenue: 0,
          totalDurationMs: 0,
          durationCount: 0,
          totalOrdersCount: 0,
        };
      }

      tableMap[rawTable].turnoverCount += 1;
      tableMap[rawTable].totalRevenue += rev;

      if (trx.createdAt && trx.completedAt) {
        const start = new Date(trx.createdAt).getTime();
        const end = new Date(trx.completedAt).getTime();
        const durationMs = Math.max(0, end - start);
        if (durationMs > 0) {
          tableMap[rawTable].totalDurationMs += durationMs;
          tableMap[rawTable].durationCount += 1;

          totalDurationMsOverall += durationMs;
          durationCountOverall += 1;
        }
      }

      if (trx.orders && Array.isArray(trx.orders)) {
        totalOrdersReceived += trx.orders.length;
        tableMap[rawTable].totalOrdersCount += trx.orders.length;

        trx.orders.forEach((order, orderIdx) => {
          if (orderIdx === 0) {
            initialOrdersCount += 1;
          } else {
            additionalOrdersCount += 1;
          }

          const orderDate = order.createdAt ? new Date(order.createdAt) : (trx.createdAt ? new Date(trx.createdAt) : null);
          const h = orderDate && !isNaN(orderDate.getTime()) ? orderDate.getHours() : 0;

          hourlyMap[h].orderCount += 1;
          hourlyMap[h].tableSet.add(tableLabel);

          if (!hourlyMap[h].tablesMap[rawTable]) {
            hourlyMap[h].tablesMap[rawTable] = {
              tableKey: rawTable,
              label: tableLabel,
              isTakeAway,
              orderCount: 0,
              totalItemsQuantity: 0,
              totalRevenue: 0,
            };
          }
          hourlyMap[h].tablesMap[rawTable].orderCount += 1;

          if (order.items && Array.isArray(order.items)) {
            const itemsInThisOrder = new Set();

            order.items.forEach(item => {
              const name = item.menuItem?.name || 'Item Tidak Dikenal';
              const category = item.menuItem?.category || 'Lainnya';
              const qty = Number(item.quantity) || 0;
              const price = Number(item.price) || 0;
              const itemTotal = qty * price;
              const image = item.menuItem?.image || null;

              if (!itemMap[name]) {
                itemMap[name] = {
                  id: item.menuItemId || name,
                  name,
                  category,
                  quantity: 0,
                  orderCount: 0,
                  totalRevenue: 0,
                  unitPrice: price,
                  image,
                };
              }

              itemMap[name].quantity += qty;
              itemMap[name].totalRevenue += itemTotal;
              if (image && !itemMap[name].image) {
                itemMap[name].image = image;
              }
              itemsInThisOrder.add(name);

              // Track hourly stats items
              hourlyMap[h].totalItemsQuantity += qty;
              hourlyMap[h].totalRevenue += itemTotal;

              hourlyMap[h].tablesMap[rawTable].totalItemsQuantity += qty;
              hourlyMap[h].tablesMap[rawTable].totalRevenue += itemTotal;

              if (!hourlyMap[h].itemsMap[name]) {
                hourlyMap[h].itemsMap[name] = {
                  name,
                  category,
                  quantity: 0,
                  totalRevenue: 0,
                  unitPrice: price,
                  image,
                };
              }
              hourlyMap[h].itemsMap[name].quantity += qty;
              hourlyMap[h].itemsMap[name].totalRevenue += itemTotal;
            });

            itemsInThisOrder.forEach(itemName => {
              if (itemMap[itemName]) {
                itemMap[itemName].orderCount += 1;
              }
            });
          }
        });
      }
    });

    const physicalTables = Object.values(tableMap).filter(t => !t.isTakeAway);
    const takeawayTables = Object.values(tableMap).filter(t => t.isTakeAway);
    const distinctTablesUsed = physicalTables.length;
    const physicalTurnoverCount = physicalTables.reduce((sum, t) => sum + t.turnoverCount, 0);

    const avgTurnoverPerTable = distinctTablesUsed > 0 ? (physicalTurnoverCount / distinctTablesUsed) : 0;
    const avgOrdersPerTable = validTrxs.length > 0 ? (totalOrdersReceived / validTrxs.length) : 0;

    const avgDurationMsOverall = durationCountOverall > 0 ? (totalDurationMsOverall / durationCountOverall) : 0;

    const tableList = Object.values(tableMap).map(t => {
      const avgDurationMs = t.durationCount > 0 ? (t.totalDurationMs / t.durationCount) : 0;
      const revenueSharePercent = totalRevenueOverall > 0 ? ((t.totalRevenue / totalRevenueOverall) * 100) : 0;
      return {
        ...t,
        avgDurationMs,
        revenueSharePercent,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const itemList = Object.values(itemMap).map(item => {
      const revenueSharePercent = totalRevenueOverall > 0 ? ((item.totalRevenue / totalRevenueOverall) * 100) : 0;
      return {
        ...item,
        revenueSharePercent
      };
    });

    // Default sort: quantity desc then totalRevenue desc
    const sortedMostToLeast = [...itemList].sort((a, b) => b.quantity - a.quantity || b.totalRevenue - a.totalRevenue);
    const itemsWithSales = sortedMostToLeast.filter(i => i.quantity > 0);

    const mostSoldItem = itemsWithSales.length > 0 ? itemsWithSales[0] : null;
    const leastSoldItem = sortedMostToLeast.length > 0 ? sortedMostToLeast[sortedMostToLeast.length - 1] : null;

    const hourlyList = Object.values(hourlyMap).map(h => ({
      ...h,
      tablesCount: h.tableSet.size,
      tableList: Object.values(h.tablesMap),
      itemList: Object.values(h.itemsMap).sort((a, b) => b.quantity - a.quantity),
    }));

    const activeHoursList = hourlyList.filter(h => h.orderCount > 0);
    const peakHour = activeHoursList.length > 0 ? [...activeHoursList].sort((a, b) => b.orderCount - a.orderCount || b.totalItemsQuantity - a.totalItemsQuantity)[0] : null;

    return {
      totalRevenueOverall,
      totalTurnoverCount,
      physicalTurnoverCount,
      distinctTablesUsed,
      takeawayCount: takeawayTables.reduce((sum, t) => sum + t.turnoverCount, 0),
      avgTurnoverPerTable,
      totalOrdersReceived,
      initialOrdersCount,
      additionalOrdersCount,
      avgOrdersPerTable,
      avgDurationMsOverall,
      paymentMethods,
      tableList,
      topTurnoverTable: [...tableList].sort((a, b) => b.turnoverCount - a.turnoverCount)[0] || null,
      topRevenueTable: tableList[0] || null,
      itemList: sortedMostToLeast,
      mostSoldItem,
      leastSoldItem,
      hourlyList,
      activeHoursList,
      peakHour,
    };
  };

  // Calculate Daily Recap for Archive Transactions
  const calculateDailyRecap = () => {
    const validTrxs = archiveTransactions.filter(trx => trx.status === 'completed');
    let totalRevenue = 0;
    let totalItemsSold = 0;
    const itemMap = {};

    const paymentMethods = {
      CASH: { count: 0, revenue: 0 },
      QRIS: { count: 0, revenue: 0 },
      CARD: { count: 0, revenue: 0 },
      UNSPECIFIED: { count: 0, revenue: 0 }
    };

    validTrxs.forEach(trx => {
      const pm = trx.paymentMethod || 'UNSPECIFIED';
      if (paymentMethods[pm]) {
        paymentMethods[pm].count += 1;
        paymentMethods[pm].revenue += Number(trx.total) || 0;
      } else {
        paymentMethods.UNSPECIFIED.count += 1;
        paymentMethods.UNSPECIFIED.revenue += Number(trx.total) || 0;
      }

      if (trx.orders && Array.isArray(trx.orders)) {
        trx.orders.forEach(order => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              const name = item.menuItem?.name || 'Item Tidak Dikenal';
              const qty = Number(item.quantity) || 0;
              const price = Number(item.price) || 0;
              const itemTotal = qty * price;

              totalItemsSold += qty;
              totalRevenue += itemTotal;

              if (!itemMap[name]) {
                itemMap[name] = {
                  name,
                  category: item.menuItem?.category || 'Lainnya',
                  quantity: 0,
                  totalRevenue: 0,
                  unitPrice: price,
                };
              }
              itemMap[name].quantity += qty;
              itemMap[name].totalRevenue += itemTotal;
            });
          }
        });
      }
    });

    const itemList = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);

    return {
      totalRevenue,
      totalItemsSold,
      totalTransactions: validTrxs.length,
      totalCancelled: archiveTransactions.filter(trx => trx.status === 'cancelled').length,
      paymentMethods,
      itemList,
    };
  };

  // Export Daily Recap to Excel (.xlsx)
  const exportToExcel = async () => {
    try {
      const recap = calculateDailyRecap();
      const XLSX = await import('xlsx');

      const formattedDateStr = archiveDate 
        ? new Date(archiveDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : archiveDate;

      // Header rows
      const sheetData = [
        ['REKAPAN PENJUALAN HARIAN'],
        [`Tanggal: ${formattedDateStr}`],
        [],
        ['RINGKASAN PENJUALAN'],
        ['Total Pendapatan Harian', '', recap.totalRevenue],
        ['Total Item / Makanan Terjual', '', `${recap.totalItemsSold} item`],
        ['Total Variasi Menu Laku', '', `${recap.itemList.length} menu`],
        ['Total Transaksi Selesai', '', `${recap.totalTransactions} transaksi`],
        [],
        ['METODE PEMBAYARAN'],
        ['Cash / Tunai', `${recap.paymentMethods.CASH.count} transaksi`, recap.paymentMethods.CASH.revenue],
        ['QRIS', `${recap.paymentMethods.QRIS.count} transaksi`, recap.paymentMethods.QRIS.revenue],
        ['Kartu Kredit / Debit ATM', `${recap.paymentMethods.CARD.count} transaksi`, recap.paymentMethods.CARD.revenue],
        [],
        ['RINCIAN PENJUALAN PER MENU'],
        ['No', 'Nama Makanan / Item', 'Kategori', 'Total Terjual (Porsi)', 'Harga Satuan (Rp)', 'Total Pendapatan Menu (Rp)']
      ];

      // Item rows
      recap.itemList.forEach((item, idx) => {
        sheetData.push([
          idx + 1,
          item.name,
          item.category || '-',
          item.quantity,
          item.unitPrice,
          item.totalRevenue
        ]);
      });

      // Footer total row
      sheetData.push([]);
      sheetData.push([
        'TOTAL KESELURUHAN (1 HARI)',
        '',
        '',
        recap.totalItemsSold,
        '',
        recap.totalRevenue
      ]);

      // Create workbook and worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Format price cells with Rupiah symbol (Rp) and 0 decimal places (Accounting format: Rp left-aligned, numbers right-aligned)
      const rupiahFormat = '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)';

      // 1. Format Ringkasan: Total Pendapatan Harian (Cell C5 -> row 4, col 2)
      const summaryRevenueCell = XLSX.utils.encode_cell({ r: 4, c: 2 });
      if (worksheet[summaryRevenueCell]) {
        worksheet[summaryRevenueCell].z = rupiahFormat;
      }

      // 2. Format Rincian: Harga Satuan (Col E/4) and Total Pendapatan Menu (Col F/5)
      recap.itemList.forEach((_, idx) => {
        const r = 11 + idx;
        const priceCell = XLSX.utils.encode_cell({ r, c: 4 });
        const totalCell = XLSX.utils.encode_cell({ r, c: 5 });
        if (worksheet[priceCell]) worksheet[priceCell].z = rupiahFormat;
        if (worksheet[totalCell]) worksheet[totalCell].z = rupiahFormat;
      });

      // 3. Format Footer: Total Keseluruhan (Col F/5 -> row sheetData.length - 1, col 5)
      const totalOverallCell = XLSX.utils.encode_cell({ r: sheetData.length - 1, c: 5 });
      if (worksheet[totalOverallCell]) {
        worksheet[totalOverallCell].z = rupiahFormat;
      }

      // Merge cells for title and summary headers so they don't get cut off
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // REKAPAN PENJUALAN HARIAN
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Tanggal
        { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }, // RINGKASAN
        { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } }, // Total Pendapatan Harian
        { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } }, // Total Item
        { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } }, // Total Variasi
        { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } }, // Total Transaksi
        { s: { r: 9, c: 0 }, e: { r: 9, c: 5 } }, // RINCIAN PENJUALAN PER MENU
        { s: { r: sheetData.length - 1, c: 0 }, e: { r: sheetData.length - 1, c: 2 } }, // TOTAL KESELURUHAN
      ];

      // Set column widths for better presentation
      worksheet['!cols'] = [
        { wch: 6 },   // No
        { wch: 30 },  // Nama Makanan
        { wch: 15 },  // Kategori
        { wch: 22 },  // Total Terjual
        { wch: 20 },  // Harga Satuan
        { wch: 28 },  // Total Pendapatan Menu
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekapan Penjualan');

      // Write and trigger download
      const filename = `Rekapan_Penjualan_${archiveDate || 'Harian'}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Failed to export excel:', err);
      alert('Gagal mengunduh file Excel');
    }
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

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategoriesList(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCategory = async (e) => {
    if (e) e.preventDefault();
    if (!newCategoryName || !newCategoryName.trim()) return;
    setCategoryModalError('');
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setCategoryModalError(data.error || 'Gagal menambahkan kategori');
        return;
      }
      setNewCategoryName('');
      fetchCategories();
    } catch (err) {
      setCategoryModalError('Terjadi kesalahan saat menambah kategori');
    }
  };

  const handleMoveCategory = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categoriesList.length) return;

    const updated = [...categoriesList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const payload = updated.map((cat, idx) => ({ id: cat.id, order: idx + 1 }));
    setCategoriesList(updated);

    try {
      await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: payload })
      });
      fetchCategories();
    } catch (err) {
      console.error('Failed to update category order:', err);
    }
  };

  const handleCategoryDragStart = (e, index) => {
    setDraggedCategoryIdx(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleCategoryDragOver = (e, index) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (draggedCategoryIdx === null || draggedCategoryIdx === index) return;

    const updated = [...categoriesList];
    const draggedItem = updated.splice(draggedCategoryIdx, 1)[0];
    updated.splice(index, 0, draggedItem);

    setDraggedCategoryIdx(index);
    setCategoriesList(updated);
  };

  const handleCategoryDragEnd = async () => {
    setDraggedCategoryIdx(null);
    if (categoriesList.length === 0) return;

    const payload = categoriesList.map((cat, idx) => ({ id: cat.id, order: idx + 1 }));
    try {
      await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: payload })
      });
      fetchCategories();
    } catch (err) {
      console.error('Failed to update category order:', err);
    }
  };

  const handleTouchStart = (e, index) => {
    setTouchDraggingIdx(index);
  };

  const handleTouchMove = (e) => {
    if (touchDraggingIdx === null || !categoryListRef.current) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetEl) return;

    const categoryItemEl = targetEl.closest('[data-category-index]');
    if (categoryItemEl) {
      const targetIdx = parseInt(categoryItemEl.getAttribute('data-category-index'), 10);
      if (!isNaN(targetIdx) && targetIdx !== touchDraggingIdx) {
        const updated = [...categoriesList];
        const item = updated.splice(touchDraggingIdx, 1)[0];
        updated.splice(targetIdx, 0, item);
        setTouchDraggingIdx(targetIdx);
        setCategoriesList(updated);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (touchDraggingIdx === null) return;
    setTouchDraggingIdx(null);

    const payload = categoriesList.map((cat, idx) => ({ id: cat.id, order: idx + 1 }));
    try {
      await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: payload })
      });
      fetchCategories();
    } catch (err) {
      console.error('Failed to update category order:', err);
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus kategori "${category.name}"?\nSemua menu di kategori ini akan dipindahkan ke kategori "Umum".`)) {
      return;
    }
    try {
      const res = await fetch(`/api/categories?id=${category.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus kategori');
        return;
      }
      fetchCategories();
      fetchMenu();
    } catch (err) {
      alert('Terjadi kesalahan saat menghapus kategori');
    }
  };

  useEffect(() => {
    if (!checkingAuth && currentUser) {
      fetchTransactions();
      fetchMenu();
      fetchCategories();
      const interval = setInterval(() => {
        if (activeTab === 'transactions') fetchTransactions();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [checkingAuth, currentUser, activeTab]);

  useEffect(() => {
    if (activeTab === 'archive' && currentUser?.role === 'ADMIN') {
      fetchArchive();
    }
  }, [activeTab, archiveDate, currentUser]);

  useEffect(() => {
    if (!statsDate) {
      setStatsDate(getLocalDateString());
    }
  }, [statsDate]);

  useEffect(() => {
    if (activeTab === 'stats' && currentUser) {
      fetchStats();
    }
  }, [activeTab, statsDate, currentUser]);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (e) {
      console.error(e);
    }
    setLoadingEmployees(false);
  };

  useEffect(() => {
    if (activeTab === 'employees' && currentUser?.role === 'ADMIN') {
      fetchEmployees();
    }
  }, [activeTab, currentUser]);

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setEmployeeError('');
    try {
      const isEditing = !!editingEmployeeId;
      const url = isEditing ? `/api/users/${editingEmployeeId}` : '/api/users';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeFormData)
      });
      if (res.ok) {
        setShowEmployeeModal(false);
        fetchEmployees();
      } else {
        const data = await res.json();
        setEmployeeError(data.error || 'Gagal menyimpan data karyawan');
      }
    } catch (err) {
      setEmployeeError('Terjadi kesalahan');
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!confirm('Hapus karyawan ini secara permanen?')) return;
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      fetchEmployees();
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Password baru dan konfirmasi tidak cocok');
      return;
    }
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword })
      });
      if (res.ok) {
        alert('Password berhasil diubah!');
        setShowPasswordModal(false);
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Gagal mengubah password');
      }
    } catch (err) {
      setPasswordError('Terjadi kesalahan');
    }
  };

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
    setIsTakeAway(false);
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
      const finalTableNumber = inputTableNumber.trim();
      const res = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber: finalTableNumber })
      });
      const data = await res.json();
      if (res.ok) {
        const orderUrl = `${window.location.origin}/order/${data.id}`;
        setActiveQr({
          id: data.id,
          tableNumber: data.tableNumber || finalTableNumber,
          url: orderUrl,
          createdAt: data.createdAt || new Date().toISOString()
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

  const openDirectTakeawayModal = () => {
    setTakeawayCustomerName('');
    setTakeawayCart({});
    setTakeawaySearch('');
    setTakeawayError('');
    setShowDirectTakeawayModal(true);
  };

  const updateTakeawayCart = (item, delta) => {
    setTakeawayCart(prev => {
      const currentQty = prev[item.id]?.quantity || 0;
      const newQty = Math.max(0, currentQty + delta);
      const newCart = { ...prev };
      if (newQty === 0) {
        delete newCart[item.id];
      } else {
        newCart[item.id] = { menuItem: item, quantity: newQty, price: item.price };
      }
      return newCart;
    });
  };

  const handleCreateDirectTakeaway = async (e) => {
    if (e) e.preventDefault();
    const cartItems = Object.values(takeawayCart);
    if (cartItems.length === 0) {
      setTakeawayError('Silakan pilih minimal 1 menu makanan / minuman.');
      return;
    }

    setSubmittingTakeaway(true);
    setTakeawayError('');

    try {
      const namePart = takeawayCustomerName.trim() ? takeawayCustomerName.trim() : Math.floor(100 + Math.random() * 900);
      const finalTableNumber = `Take Away - ${namePart}`;

      // 1. Create transaction
      const trxRes = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber: finalTableNumber })
      });

      const trxData = await trxRes.json();
      if (!trxRes.ok) {
        setTakeawayError(trxData.error || 'Gagal membuat transaksi Take Away.');
        setSubmittingTakeaway(false);
        return;
      }

      // 2. Submit order items directly
      const orderPayload = {
        transactionId: trxData.id,
        items: cartItems.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          price: item.price
        })),
        isTakeaway: true
      };

      const orderRes = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (orderRes.ok) {
        setShowDirectTakeawayModal(false);
        setTakeawayCart({});
        fetchTransactions();
      } else {
        const orderErr = await orderRes.json();
        setTakeawayError(orderErr.error || 'Gagal membuat pesanan Take Away.');
      }
    } catch (err) {
      console.error(err);
      setTakeawayError('Terjadi kesalahan server.');
    }
    setSubmittingTakeaway(false);
  };

  const openPaymentModal = (trx) => {
    setPaymentTransaction(trx);
    setSelectedPaymentMethod('CASH');
    setShowPaymentModal(true);
  };

  const confirmCompleteTransaction = async () => {
    if (!paymentTransaction) return;
    setSubmittingPayment(true);
    try {
      await fetch(`/api/transaction/${paymentTransaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          paymentMethod: selectedPaymentMethod
        })
      });
      setShowPaymentModal(false);
      setPaymentTransaction(null);
      if (activeTab === 'transactions') fetchTransactions();
      if (activeTab === 'archive') fetchArchive();
      if (activeTab === 'stats') fetchStats();
    } catch (e) {
      console.error(e);
    }
    setSubmittingPayment(false);
  };

  const handleChangeTableNumber = async (id, currentNumber) => {
    const newTable = prompt('Masukkan nomor meja / nama pelanggan baru:', currentNumber);
    if (!newTable || newTable.trim() === '' || newTable === currentNumber) return;
    
    try {
      const res = await fetch(`/api/transaction/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber: newTable.trim() })
      });
      if (res.ok) {
        if (activeTab === 'transactions') fetchTransactions();
        if (activeTab === 'archive') fetchArchive();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal mengganti nomor meja.');
      }
    } catch (err) {
      alert('Terjadi kesalahan server.');
    }
  };

  const cancelTransaction = async (id) => {
    if (!confirm('Yakin ingin membatalkan pesanan ini?')) return;
    try {
      await fetch(`/api/transaction/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (activeTab === 'transactions') fetchTransactions();
      if (activeTab === 'archive') fetchArchive();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTransaction = async (id) => {
    if (!confirm('Yakin ingin menghapus transaksi ini secara permanen? Data tidak dapat dikembalikan.')) return;
    try {
      await fetch(`/api/transaction/${id}`, {
        method: 'DELETE',
      });
      if (activeTab === 'transactions') fetchTransactions();
      if (activeTab === 'archive') fetchArchive();
    } catch (e) {
      console.error(e);
    }
  };

  const printQR = () => {
    window.print();
  };

  const showQRForTransaction = (trx) => {
    const orderUrl = `${window.location.origin}/order/${trx.id}`;
    setActiveQr({
      id: trx.id,
      tableNumber: trx.tableNumber || '-',
      url: orderUrl,
      createdAt: trx.createdAt || new Date().toISOString()
    });
  };

  const openEditOrderModal = (trx) => {
    setEditingTransaction(trx);
    const consolidated = [];
    trx.orders?.forEach(order => {
      order.items?.forEach(item => {
        const existing = consolidated.find(c => c.menuItem.id === item.menuItem.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          consolidated.push({
            menuItem: item.menuItem,
            quantity: item.quantity,
            price: item.price
          });
        }
      });
    });
    setEditingOrderItems(consolidated);
    setEditOrderSearch('');
    setShowEditOrderModal(true);
  };

  const updateEditingQuantity = (menuItemId, delta) => {
    setEditingOrderItems(prev => {
      return prev.map(item => {
        if (item.menuItem.id === menuItemId) {
          return { ...item, quantity: item.quantity + delta };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const addNewItemToEditing = (menuItem) => {
    setEditingOrderItems(prev => {
      const existing = prev.find(item => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map(item => item.menuItem.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prev, { menuItem, quantity: 1, price: menuItem.price }];
      }
    });
  };

  const handleSaveEditOrder = async () => {
    try {
      const payload = {
        items: editingOrderItems.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          price: item.price
        }))
      };
      const res = await fetch(`/api/transaction/${editingTransaction.id}/edit-order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowEditOrderModal(false);
        if (activeTab === 'transactions') fetchTransactions();
        if (activeTab === 'archive') fetchArchive();
      } else {
        alert('Gagal menyimpan pesanan.');
      }
    } catch (e) {
      console.error(e);
      alert('Terjadi kesalahan.');
    }
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

  const handleToggleAvailability = async (item) => {
    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      if (res.ok) {
        fetchMenu();
      } else {
        alert('Gagal mengubah status ketersediaan menu.');
      }
    } catch (err) {
      alert('Terjadi kesalahan server.');
    }
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

  const categoryOrderMap = {};
  if (Array.isArray(categoriesList) && categoriesList.length > 0) {
    categoriesList.forEach((c, i) => {
      categoryOrderMap[c.name] = c.order !== undefined ? c.order : i;
    });
  }

  const filteredMenu = menuList.filter(item =>
    item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(menuSearch.toLowerCase()))
  ).sort((a, b) => {
    const orderA = categoryOrderMap[a.category || 'Umum'] !== undefined ? categoryOrderMap[a.category || 'Umum'] : 999;
    const orderB = categoryOrderMap[b.category || 'Umum'] !== undefined ? categoryOrderMap[b.category || 'Umum'] : 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {/* Top Header Bar */}
      <div className="header-bar">
        <div>
          <h1>Kasir Pintar <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary-color)', background: 'rgba(99,102,241,0.1)', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>{currentUser?.role === 'ADMIN' ? 'Admin Mode' : 'Kasir Mode'}</span></h1>
          <p>Kelola pesanan transaksi & daftar menu makanan/minuman</p>
        </div>
        <div style={{ position: 'relative' }}>
          <button 
            className="btn btn-outline flex items-center" 
            style={{ gap: '8px', padding: '0.5rem 1rem' }}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <User size={18} /> 
            <span style={{ fontWeight: 600 }}>{currentUser?.name || currentUser?.username || 'Akun'}</span>
            <ChevronDown size={16} />
          </button>
          
          {showProfileMenu && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', width: '220px', zIndex: 50, padding: '0.5rem' }}>
              <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{currentUser?.name || currentUser?.username}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Role: {currentUser?.role || 'KASIR'}</p>
              </div>
              <button 
                className="btn" 
                style={{ width: '100%', textAlign: 'left', background: 'transparent', color: 'var(--text-color)', padding: '0.5rem', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}
                onClick={() => {
                  setShowProfileMenu(false);
                  setPasswordError('');
                  setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                  setShowPasswordModal(true);
                }}
              >
                <Key size={16} style={{ marginRight: '8px' }} /> Ganti Password
              </button>
              <button 
                className="btn" 
                style={{ width: '100%', textAlign: 'left', background: 'transparent', color: '#ef4444', padding: '0.5rem', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}
                onClick={handleLogout}
              >
                <LogOut size={16} style={{ marginRight: '8px' }} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <button
          className={`btn ${activeTab === 'transactions' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('transactions')}
        >
          <Receipt size={18} style={{ marginRight: '8px' }} /> Transaksi Hari Ini
        </button>
        
        {currentUser?.role === 'ADMIN' && (
          <button
            className={`btn ${activeTab === 'archive' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('archive')}
          >
            <RefreshCcw size={18} style={{ marginRight: '8px' }} /> Arsip Transaksi
          </button>
        )}
        
        <button
          className={`btn ${activeTab === 'stats' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 size={18} style={{ marginRight: '8px' }} /> Statistik Meja
        </button>
        
        <button
          className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('menu')}
        >
          <Utensils size={18} style={{ marginRight: '8px' }} /> Kelola Menu & Foto
        </button>

        {currentUser?.role === 'ADMIN' && (
          <button
            className={`btn ${activeTab === 'employees' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('employees')}
          >
            <Users size={18} style={{ marginRight: '8px' }} /> Kelola Karyawan
          </button>
        )}
      </div>

      {/* TAB 1: TRANSAKSI & QR */}
      {activeTab === 'transactions' && (
        <div>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h2>Daftar Transaksi Realtime</h2>
            <div className="flex gap-4 items-center flex-wrap">
              <div style={{ position: 'relative', minWidth: '200px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Cari meja..."
                  style={{ paddingLeft: '2rem', paddingRight: '1rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.85rem' }}
                  value={transactionSearch}
                  onChange={(e) => setTransactionSearch(e.target.value)}
                />
              </div>
              <button className="btn btn-outline" onClick={fetchTransactions}>
                <RefreshCcw size={18} style={{ marginRight: '8px' }} /> Refresh
              </button>
              <button 
                className="btn" 
                style={{ background: '#f59e0b', color: 'white', borderColor: '#f59e0b' }} 
                onClick={openDirectTakeawayModal}
              >
                <ShoppingBag size={18} style={{ marginRight: '8px' }} /> Pesan Take Away Direct
              </button>
              <button className="btn btn-primary" onClick={openTableModal}>
                <Plus size={18} style={{ marginRight: '8px' }} /> Buat QR Pesanan Baru
              </button>
            </div>
          </div>

          {activeQr && (() => {
            const dt = formatDateTimeIndonesian(activeQr.createdAt);
            return (
              <div className="glass-card print-qr-card mb-4 flex flex-col items-center text-center p-5" style={{ border: '2px solid var(--primary-color)' }}>
                <div style={{
                  background: 'var(--primary-color)',
                  color: 'white',
                  padding: '0.35rem 1.2rem',
                  borderRadius: '20px',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  marginBottom: '0.5rem',
                  display: 'inline-block'
                }}>
                  {activeQr.tableNumber?.toLowerCase().includes('take away') ? activeQr.tableNumber : `MEJA ${activeQr.tableNumber}`}
                </div>
                <h2 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
                  QR Code Pesanan {activeQr.tableNumber?.toLowerCase().includes('take away') ? activeQr.tableNumber : `Meja ${activeQr.tableNumber}`}
                </h2>
                <p style={{ margin: '0.3rem 0 0.6rem 0', fontSize: '0.85rem', opacity: 0.85 }}>
                  Scan QR Code di bawah untuk melihat menu & melakukan pemesanan makanan/minuman.
                </p>
                
                <div className="qr-container my-1 p-2.5" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'inline-block' }}>
                  <QRCodeSVG value={activeQr.url} size={190} />
                </div>
                
                {/* Information Badge for Hari, Tanggal, Jam saat QR dibuat */}
                <div className="qr-time-info mt-2 mb-2 p-2.5" style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  borderRadius: '12px',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  width: '100%',
                  maxWidth: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Waktu QR Code Dibuat
                  </div>
                  <div className="flex justify-center items-center gap-4 flex-wrap" style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={15} style={{ color: 'var(--primary-color)' }} />
                      {dt.day}, {dt.date}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={15} style={{ color: 'var(--primary-color)' }} />
                      {dt.time}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.8rem', wordBreak: 'break-all', opacity: 0.8, maxWidth: '420px', marginTop: '0.4rem', marginBottom: '0.2rem' }}>
                  Kode Transaksi: <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '4px' }}>{activeQr.id}</code>
                </p>
                <p className="no-print" style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>
                  URL: <a href={activeQr.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>{activeQr.url}</a>
                </p>

                <div className="flex gap-4 mt-3 no-print">
                  <button className="btn btn-outline" onClick={() => setActiveQr(null)}>Tutup</button>
                  <button className="btn btn-secondary" onClick={printQR}>
                    <Printer size={18} style={{ marginRight: '8px' }} /> Cetak QR Code Meja
                  </button>
                </div>
              </div>
            );
          })()}

          {loadingTransactions && transactions.length === 0 ? (
            <p>Memuat data transaksi...</p>
          ) : (
            <div className="grid grid-cols-2">
              {[...transactions]
                .filter(trx => trx.tableNumber?.toLowerCase().includes(transactionSearch.toLowerCase()) || trx.id.toLowerCase().includes(transactionSearch.toLowerCase()))
                .sort((a, b) => {
                  const isKelar = (status) => status === 'completed' || status === 'cancelled';
                  const aKelar = isKelar(a.status) ? 1 : 0;
                  const bKelar = isKelar(b.status) ? 1 : 0;
                  if (aKelar !== bKelar) {
                    return aKelar - bKelar;
                  }
                  // Sort by newest created first (descending: newest -> oldest)
                  const timeA = new Date(a.createdAt).getTime() || 0;
                  const timeB = new Date(b.createdAt).getTime() || 0;
                  return timeB - timeA;
                })
                .map(trx => (
                <div key={trx.id} className="glass-card flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <span style={{
                        background: 'var(--primary-color)',
                        color: 'white',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap'
                      }}>
                        {trx.tableNumber?.toLowerCase().includes('take away') ? trx.tableNumber : `MEJA ${trx.tableNumber || '-'}`}
                        <button 
                          onClick={() => handleChangeTableNumber(trx.id, trx.tableNumber)}
                          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex' }}
                          title="Ganti Nomor Meja"
                        >
                          <Edit3 size={12} />
                        </button>
                      </span>
                      <span className={`badge badge-${trx.status === 'cancelled' ? 'danger' : trx.status}`} style={{ textAlign: 'right' }}>
                        {trx.status === 'open' ? 'Menunggu Pesanan' : trx.status === 'ordered' ? 'Perlu Dibayar' : trx.status === 'cancelled' ? 'Dibatalkan' : 'Selesai'}
                      </span>
                    </div>
                    <div style={{ marginBottom: '0.85rem' }}>
                      <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', opacity: 0.7, wordBreak: 'break-all' }}>ID: {trx.id.substring(0, 20)}...</h3>
                      <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.03)', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                          <span><strong>Order Dibuat:</strong> {trx.createdAt ? new Date(trx.createdAt).toLocaleString('id-ID') : '-'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={14} style={{ color: trx.completedAt || trx.status === 'completed' ? '#10b981' : '#9ca3af', flexShrink: 0 }} />
                          <span>
                            <strong>Order Selesai:</strong> {
                              trx.completedAt 
                                ? new Date(trx.completedAt).toLocaleString('id-ID') 
                                : trx.status === 'completed' 
                                  ? new Date(trx.createdAt).toLocaleString('id-ID') 
                                  : <span style={{ opacity: 0.65, fontStyle: 'italic' }}>Belum Selesai</span>
                            }
                          </span>
                        </div>
                        {trx.paymentMethod && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                              background: trx.paymentMethod === 'CASH' ? 'rgba(16, 185, 129, 0.12)' : trx.paymentMethod === 'QRIS' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                              color: trx.paymentMethod === 'CASH' ? '#059669' : trx.paymentMethod === 'QRIS' ? '#2563eb' : '#7c3aed',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {trx.paymentMethod === 'CASH' ? <Banknote size={13} /> : trx.paymentMethod === 'QRIS' ? <Smartphone size={13} /> : <CreditCard size={13} />}
                              Bayar: {trx.paymentMethod === 'CASH' ? 'Cash / Tunai' : trx.paymentMethod === 'QRIS' ? 'QRIS' : 'Kartu Debit/Kredit'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {trx.orders && trx.orders.length > 0 ? (
                      <div className="mt-4">
                        <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>Daftar Pesanan:</p>
                        <div className="custom-scrollbar" style={{ height: '180px', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.02)' }}>
                          <ul style={{ paddingLeft: '1rem', marginTop: '0', marginBottom: '0' }}>
                            {trx.orders.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)).map((order, orderIdx) => (
                              <div key={order.id} style={{ marginBottom: '0.5rem' }}>
                                {orderIdx > 0 && <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', margin: '0.25rem 0' }}><Plus size={12} style={{display:'inline', marginRight: '2px'}}/> Pesanan Tambahan</p>}
                                {order.isTakeaway && <div style={{ fontSize: '0.7rem', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, display: 'inline-block', marginBottom: '4px' }}>Bungkus (Take Away)</div>}
                                <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                                  {order.items.map(item => (
                                    <li key={item.id} style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                      {item.quantity}x {item.menuItem?.name || 'Item'}
                                      <span style={{ float: 'right' }}>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>Daftar Pesanan:</p>
                        <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1rem', background: 'rgba(0,0,0,0.02)' }}>
                          <p style={{ fontStyle: 'italic', opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>Belum ada pesanan.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                    {trx.orders && trx.orders.length > 0 && (
                      <div className="flex justify-between items-center mb-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Total:</span>
                        <span className="text-primary" style={{ fontWeight: 800, fontSize: '1.3rem' }}>
                          Rp {trx.total.toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                    {trx.status === 'ordered' && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => openPaymentModal(trx)}
                        style={{ width: '100%', marginBottom: '0.75rem' }}
                      >
                        <Check size={18} style={{ marginRight: '8px' }} /> Tandai Selesai (Sudah Dibayar)
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                    {trx.status !== 'completed' && trx.status !== 'cancelled' && (
                      <>
                        <button
                          className="btn btn-outline"
                          onClick={() => showQRForTransaction(trx)}
                          style={{ fontSize: '0.85rem', padding: '0.4rem', width: '100%' }}
                          title="Tampilkan ulang QR Code"
                        >
                          <QrCode size={16} /> QR
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => openEditOrderModal(trx)}
                          style={{ fontSize: '0.85rem', padding: '0.4rem', width: '100%' }}
                        >
                          <Edit3 size={16} style={{ marginRight: '4px' }} /> Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => cancelTransaction(trx.id)}
                          style={{ fontSize: '0.85rem', padding: '0.4rem', width: '100%' }}
                        >
                          <X size={16} style={{ marginRight: '4px' }} /> Batalkan
                        </button>
                      </>
                    )}
                    {currentUser?.role === 'ADMIN' && (
                      <button
                        className="btn btn-danger"
                        onClick={() => deleteTransaction(trx.id)}
                        style={{ 
                          fontSize: '0.85rem', 
                          padding: '0.4rem', 
                          width: '100%', 
                          background: 'transparent', 
                          color: '#ef4444', 
                          border: '1px solid #ef4444',
                          gridColumn: (trx.status === 'completed' || trx.status === 'cancelled') ? 'span 2' : 'span 1'
                        }}
                      >
                        <Trash2 size={16} style={{ marginRight: '4px' }} /> Hapus
                      </button>
                    )}
                  </div>
                </div>
                </div>
              ))}
              {transactions.length === 0 && !loadingTransactions && (
                <p>Belum ada transaksi hari ini.</p>
              )}
            </div>
          )}

          {/* Modal Dialog Direct Take Away Order (Tanpa QR) */}
          {showDirectTakeawayModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', background: 'var(--bg-color)', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
                <div className="flex justify-between items-center mb-3 pb-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-2">
                    <div style={{ background: '#f59e0b', color: 'white', padding: '6px', borderRadius: '10px' }}>
                      <ShoppingBag size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Pesan Take Away Direct (Tanpa QR)</h3>
                      <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.7 }}>Buat pesanan dibungkus langsung dari kasir/admin</p>
                    </div>
                  </div>
                  <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowDirectTakeawayModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                {takeawayError && (
                  <div style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    marginBottom: '0.75rem'
                  }}>
                    {takeawayError}
                  </div>
                )}

                {/* Customer Name Input */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Nama Pelanggan / Catatan Antrean (Opsional):
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Contoh: Pak Budi, Antrean 03..."
                    value={takeawayCustomerName}
                    onChange={(e) => setTakeawayCustomerName(e.target.value)}
                    style={{ fontSize: '0.85rem', borderRadius: '10px' }}
                  />
                </div>

                {/* Main 2-Column Section */}
                <div className="flex flex-col md:flex-row gap-4 overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
                  {/* Left Column: Menu Picker */}
                  <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--border-color)', paddingRight: '0.75rem' }}>
                    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                      <input
                        type="text"
                        className="input"
                        placeholder="Cari makanan / minuman..."
                        style={{ paddingLeft: '2.2rem', fontSize: '0.85rem', borderRadius: '10px' }}
                        value={takeawaySearch}
                        onChange={(e) => setTakeawaySearch(e.target.value)}
                      />
                    </div>

                    <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
                      {menuList
                        .filter(item => item.isAvailable !== false)
                        .filter(item => item.name.toLowerCase().includes(takeawaySearch.toLowerCase()) || (item.category && item.category.toLowerCase().includes(takeawaySearch.toLowerCase())))
                        .map(item => {
                          const cartQty = takeawayCart[item.id]?.quantity || 0;
                          return (
                            <div key={item.id} className="flex justify-between items-center p-2" style={{ background: 'var(--card-bg)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                              <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h4>
                                <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700 }}>
                                  Rp {item.price.toLocaleString('id-ID')}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                {cartQty > 0 ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(239, 68, 68, 0.08)', padding: '0.15rem 0.35rem', borderRadius: '14px', border: '1px solid #ef4444' }}>
                                    <button
                                      onClick={() => updateTakeawayCart(item, -1)}
                                      style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', minWidth: '18px', textAlign: 'center', color: '#ef4444' }}>
                                      {cartQty}
                                    </span>
                                    <button
                                      onClick={() => updateTakeawayCart(item, 1)}
                                      style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => updateTakeawayCart(item, 1)}
                                    style={{ padding: '0.3rem 0.75rem', borderRadius: '12px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                                  >
                                    + Tambah
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Right Column: Selected Items Cart Summary */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 800 }}>Ringkasan Pesanan Take Away</h4>
                    
                    <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem', paddingRight: '0.25rem', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem', background: 'rgba(0,0,0,0.02)' }}>
                      {Object.values(takeawayCart).length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', opacity: 0.6, fontSize: '0.85rem' }}>
                          Belum ada item dipilih.
                        </div>
                      ) : (
                        Object.values(takeawayCart).map(item => (
                          <div key={item.menuItem.id} className="flex justify-between items-center p-2" style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ flex: 1 }}>
                              <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>{item.menuItem.name}</h5>
                              <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                                {item.quantity} x Rp {item.price.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#ef4444' }}>
                              Rp {(item.quantity * item.price).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      <div className="flex justify-between items-center mb-3">
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Total Pembayaran:</span>
                        <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#ef4444' }}>
                          Rp {Object.values(takeawayCart).reduce((sum, i) => sum + (i.price * i.quantity), 0).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button className="btn btn-outline" style={{ width: '35%', fontSize: '0.85rem' }} onClick={() => setShowDirectTakeawayModal(false)}>
                          Batal
                        </button>
                        <button
                          className="btn"
                          style={{ width: '65%', background: '#f59e0b', color: 'white', borderColor: '#f59e0b', fontWeight: 800, fontSize: '0.88rem' }}
                          onClick={handleCreateDirectTakeaway}
                          disabled={submittingTakeaway || Object.keys(takeawayCart).length === 0}
                        >
                          {submittingTakeaway ? 'Mengirim...' : 'Kirim Pesanan Take Away'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Dialog Close Order / Pilih Metode Pembayaran */}
          {showPaymentModal && paymentTransaction && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '480px', background: 'var(--bg-color)', position: 'relative', borderRadius: '20px', padding: '1.5rem' }}>
                <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Pilih Metode Pembayaran</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
                      Selesaikan transaksi untuk {paymentTransaction.tableNumber?.toLowerCase().includes('take away') ? paymentTransaction.tableNumber : `Meja ${paymentTransaction.tableNumber || '-'}`}
                    </p>
                  </div>
                  <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowPaymentModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                {/* Total Payment Amount Header */}
                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  borderRadius: '14px',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  padding: '1rem',
                  textAlign: 'center',
                  marginBottom: '1.25rem'
                }}>
                  <span style={{ fontSize: '0.82rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Total Tagihan</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary-color)', marginTop: '0.2rem' }}>
                    Rp {paymentTransaction.total.toLocaleString('id-ID')}
                  </div>
                </div>

                {/* Payment Method Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {/* Option 1: Cash */}
                  <div
                    onClick={() => setSelectedPaymentMethod('CASH')}
                    style={{
                      border: selectedPaymentMethod === 'CASH' ? '2px solid #10b981' : '1px solid var(--border-color)',
                      background: selectedPaymentMethod === 'CASH' ? 'rgba(16, 185, 129, 0.08)' : 'var(--card-bg)',
                      padding: '0.9rem 1rem',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#10b981', color: 'white', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                        <Banknote size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: selectedPaymentMethod === 'CASH' ? '#047857' : 'inherit' }}>Cash / Tunai</div>
                        <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>Pembayaran uang tunai fisik di kasir</div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={selectedPaymentMethod === 'CASH'}
                      onChange={() => setSelectedPaymentMethod('CASH')}
                      style={{ accentColor: '#10b981', width: '18px', height: '18px' }}
                    />
                  </div>

                  {/* Option 2: QRIS */}
                  <div
                    onClick={() => setSelectedPaymentMethod('QRIS')}
                    style={{
                      border: selectedPaymentMethod === 'QRIS' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                      background: selectedPaymentMethod === 'QRIS' ? 'rgba(59, 130, 246, 0.08)' : 'var(--card-bg)',
                      padding: '0.9rem 1rem',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#3b82f6', color: 'white', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                        <Smartphone size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: selectedPaymentMethod === 'QRIS' ? '#1d4ed8' : 'inherit' }}>QRIS</div>
                        <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>Scan QRIS E-Wallet / Mobile Banking</div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={selectedPaymentMethod === 'QRIS'}
                      onChange={() => setSelectedPaymentMethod('QRIS')}
                      style={{ accentColor: '#3b82f6', width: '18px', height: '18px' }}
                    />
                  </div>

                  {/* Option 3: Card */}
                  <div
                    onClick={() => setSelectedPaymentMethod('CARD')}
                    style={{
                      border: selectedPaymentMethod === 'CARD' ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
                      background: selectedPaymentMethod === 'CARD' ? 'rgba(139, 92, 246, 0.08)' : 'var(--card-bg)',
                      padding: '0.9rem 1rem',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#8b5cf6', color: 'white', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                        <CreditCard size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: selectedPaymentMethod === 'CARD' ? '#6d28d9' : 'inherit' }}>Kartu Kredit / Debit ATM</div>
                        <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>Mesin EDC Bank Debit / Kredit</div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={selectedPaymentMethod === 'CARD'}
                      onChange={() => setSelectedPaymentMethod('CARD')}
                      style={{ accentColor: '#8b5cf6', width: '18px', height: '18px' }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-between">
                  <button type="button" className="btn btn-outline" style={{ width: '35%' }} onClick={() => setShowPaymentModal(false)}>
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '65%', fontWeight: 800, borderRadius: '14px', padding: '0.75rem' }}
                    onClick={confirmCompleteTransaction}
                    disabled={submittingPayment}
                  >
                    {submittingPayment ? 'Memproses...' : 'Selesaikan Transaksi & Bayar'}
                  </button>
                </div>
              </div>
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

          {/* Modal Dialog Edit Order */}
          {showEditOrderModal && editingTransaction && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', background: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3>Edit Pesanan (Meja {editingTransaction.tableNumber || '-'})</h3>
                  <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowEditOrderModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="flex flex-col md:flex-row gap-6 overflow-hidden" style={{ flex: 1 }}>
                  {/* Left Column: Current Order Items */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Daftar Pesanan Saat Ini</h4>
                    {editingOrderItems.length === 0 ? (
                      <p style={{ opacity: 0.7, fontStyle: 'italic' }}>Belum ada item pesanan.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {editingOrderItems.map(item => (
                          <div key={item.menuItem.id} className="flex justify-between items-center p-2" style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{item.menuItem.name}</p>
                              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>Rp {item.price.toLocaleString('id-ID')} / item</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button className="btn btn-outline" style={{ padding: '0.1rem 0.4rem' }} onClick={() => updateEditingQuantity(item.menuItem.id, -1)}>-</button>
                              <span style={{ fontWeight: 700, minWidth: '1.5rem', textAlign: 'center' }}>{item.quantity}</span>
                              <button className="btn btn-outline" style={{ padding: '0.1rem 0.4rem' }} onClick={() => updateEditingQuantity(item.menuItem.id, 1)}>+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-auto pt-4 flex justify-between items-center">
                      <span style={{ fontWeight: 600 }}>Total Estimasi:</span>
                      <span className="text-primary" style={{ fontWeight: 800, fontSize: '1.2rem' }}>
                        Rp {editingOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Menu Selection */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Tambah Item Baru</h4>
                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                      <input
                        type="text"
                        className="input"
                        placeholder="Cari menu..."
                        style={{ paddingLeft: '2rem', fontSize: '0.85rem' }}
                        value={editOrderSearch}
                        onChange={(e) => setEditOrderSearch(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {menuList
                        .filter(m => m.name.toLowerCase().includes(editOrderSearch.toLowerCase()))
                        .map(menu => (
                          <div key={menu.id} className="flex justify-between items-center p-2" style={{ borderBottom: '1px solid var(--border-color)', opacity: menu.isAvailable === false ? 0.6 : 1 }}>
                            <div>
                              <div className="flex items-center gap-2">
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{menu.name}</p>
                                {menu.isAvailable === false && (
                                  <span style={{ background: '#ef4444', color: 'white', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>Habis</span>
                                )}
                              </div>
                              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>Rp {menu.price.toLocaleString('id-ID')}</p>
                            </div>
                            {menu.isAvailable !== false && (
                              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => addNewItemToEditing(menu)}>
                                <Plus size={14} /> Tambah
                              </button>
                            )}
                          </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-end mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <button className="btn btn-outline" onClick={() => setShowEditOrderModal(false)}>Batal</button>
                  <button className="btn btn-primary" onClick={handleSaveEditOrder}>Simpan Perubahan</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: ARSIP TRANSAKSI */}
      {activeTab === 'archive' && (
        <div>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h2>Arsip Transaksi</h2>
            <div className="flex items-center gap-4">
              <input 
                type="date" 
                className="input" 
                style={{ width: 'auto' }}
                value={archiveDate}
                onChange={(e) => setArchiveDate(e.target.value)}
              />
              <button className="btn btn-outline" onClick={fetchArchive}>
                <RefreshCcw size={18} style={{ marginRight: '8px' }} /> Tampilkan
              </button>
            </div>
          </div>

          {loadingArchive ? (
            <p>Memuat data arsip transaksi...</p>
          ) : (
            <>
              {/* REKAPAN PENJUALAN HARIAN */}
              {(() => {
                const recap = calculateDailyRecap();
                return (
                  <div className="glass-card mb-6 p-6" style={{ background: 'var(--card-bg, rgba(255,255,255,0.85))', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <div className="flex justify-between items-center mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
                      <div className="flex items-center gap-3" style={{ minWidth: '280px' }}>
                        <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.6rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={22} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, lineHeight: '1.3', paddingBottom: '0.2rem' }}>Rekapan Penjualan Harian</h3>
                          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.3' }}>
                            Tanggal: {archiveDate ? new Date(archiveDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <button 
                          className="btn btn-outline flex items-center gap-2" 
                          onClick={exportToExcel}
                          style={{ background: '#10b981', color: 'white', borderColor: '#10b981', fontSize: '0.85rem', padding: '0.4rem 0.85rem', cursor: 'pointer' }}
                        >
                          <Download size={16} /> Download Excel
                        </button>
                        <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                          {recap.totalTransactions} Transaksi Selesai
                        </span>
                        {recap.totalCancelled > 0 && (
                          <span className="badge badge-danger" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                            {recap.totalCancelled} Dibatalkan
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stat Summary Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#2563eb', fontWeight: 600 }}>Total Pendapatan Harian</p>
                        <h3 style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#1d4ed8' }}>
                          Rp {recap.totalRevenue.toLocaleString('id-ID')}
                        </h3>
                      </div>
                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>Total Item / Makanan Terjual</p>
                        <h3 style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#047857' }}>
                          {recap.totalItemsSold} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>item</span>
                        </h3>
                      </div>
                      <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#d97706', fontWeight: 600 }}>Total Variasi Menu Laku</p>
                        <h3 style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#b45309' }}>
                          {recap.itemList.length} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>menu</span>
                        </h3>
                      </div>
                    </div>

                    {/* Payment Methods Breakdown Cards */}
                    <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Receipt size={18} style={{ color: 'var(--primary-color)' }} />
                        Rincian Metode Pembayaran (Metode Payment)
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {/* Cash */}
                        <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ background: '#10b981', color: 'white', padding: '6px', borderRadius: '8px' }}>
                            <Banknote size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#047857' }}>Cash / Tunai</div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#047857' }}>
                              Rp {recap.paymentMethods.CASH.revenue.toLocaleString('id-ID')}
                            </div>
                            <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>{recap.paymentMethods.CASH.count} transaksi</div>
                          </div>
                        </div>

                        {/* QRIS */}
                        <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ background: '#3b82f6', color: 'white', padding: '6px', borderRadius: '8px' }}>
                            <Smartphone size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8' }}>QRIS</div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1d4ed8' }}>
                              Rp {recap.paymentMethods.QRIS.revenue.toLocaleString('id-ID')}
                            </div>
                            <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>{recap.paymentMethods.QRIS.count} transaksi</div>
                          </div>
                        </div>

                        {/* Card */}
                        <div style={{ background: 'rgba(139, 92, 246, 0.08)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ background: '#8b5cf6', color: 'white', padding: '6px', borderRadius: '8px' }}>
                            <CreditCard size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6d28d9' }}>Kartu Kredit / Debit ATM</div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#6d28d9' }}>
                              Rp {recap.paymentMethods.CARD.revenue.toLocaleString('id-ID')}
                            </div>
                            <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>{recap.paymentMethods.CARD.count} transaksi</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Table of Sales per Menu */}
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Utensils size={18} /> Rincian Penjualan Per Menu Makanan / Minuman
                      </h4>
                      {recap.itemList.length > 0 ? (
                        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem 1rem', width: '50px' }}>No</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Nama Makanan / Item</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Total Terjual (Porsi)</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Harga Satuan</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Uang Didapatkan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recap.itemList.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                  <td style={{ padding: '0.7rem 1rem', fontWeight: 600, opacity: 0.6 }}>{idx + 1}</td>
                                  <td style={{ padding: '0.7rem 1rem', fontWeight: 600 }}>{item.name}</td>
                                  <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                                    <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem' }}>
                                      {item.quantity}x
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right', opacity: 0.8 }}>
                                    Rp {item.unitPrice.toLocaleString('id-ID')}
                                  </td>
                                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary-color)' }}>
                                    Rp {item.totalRevenue.toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: 'rgba(59, 130, 246, 0.05)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                                <td colSpan={2} style={{ padding: '0.85rem 1rem', fontSize: '0.95rem' }}>TOTAL KESELURUHAN (1 HARI)</td>
                                <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#059669', fontSize: '1rem' }}>
                                  {recap.totalItemsSold} Item
                                </td>
                                <td></td>
                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#2563eb', fontSize: '1.15rem' }}>
                                  Rp {recap.totalRevenue.toLocaleString('id-ID')}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <p style={{ fontStyle: 'italic', opacity: 0.7, margin: 0, padding: '1rem 0' }}>
                          Belum ada transaksi penjualan pada tanggal ini.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              <h3 className="mb-4 mt-6" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Daftar Transaksi Individual ({archiveTransactions.length})</h3>
              <div className="grid grid-cols-2">
                {[...archiveTransactions]
                  .sort((a, b) => {
                    const isKelar = (status) => status === 'completed' || status === 'cancelled';
                    const aKelar = isKelar(a.status) ? 1 : 0;
                    const bKelar = isKelar(b.status) ? 1 : 0;
                    if (aKelar !== bKelar) {
                      return aKelar - bKelar;
                    }
                    const timeA = new Date(a.createdAt).getTime() || 0;
                    const timeB = new Date(b.createdAt).getTime() || 0;
                    return timeB - timeA;
                  })
                  .map(trx => (
                <div key={trx.id} className="glass-card flex flex-col justify-between" style={{ opacity: trx.status === 'cancelled' ? 0.7 : 1 }}>
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
                          MEJA {trx.tableNumber || '-'}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>ID: {trx.id.substring(0, 16)}...</h3>
                      </div>
                      <span className={`badge badge-${trx.status === 'cancelled' ? 'danger' : trx.status}`}>
                        {trx.status === 'open' ? 'Menunggu Pesanan' : trx.status === 'ordered' ? 'Perlu Dibayar' : trx.status === 'cancelled' ? 'Dibatalkan' : 'Selesai'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.03)', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                        <span><strong>Order Dibuat:</strong> {trx.createdAt ? new Date(trx.createdAt).toLocaleString('id-ID') : '-'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle size={14} style={{ color: trx.completedAt || trx.status === 'completed' ? '#10b981' : '#9ca3af', flexShrink: 0 }} />
                        <span>
                          <strong>Order Selesai:</strong> {
                            trx.completedAt 
                              ? new Date(trx.completedAt).toLocaleString('id-ID') 
                              : trx.status === 'completed' 
                                ? new Date(trx.createdAt).toLocaleString('id-ID') 
                                : <span style={{ opacity: 0.65, fontStyle: 'italic' }}>Belum Selesai</span>
                          }
                        </span>
                      </div>
                      {trx.paymentMethod && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: trx.paymentMethod === 'CASH' ? 'rgba(16, 185, 129, 0.12)' : trx.paymentMethod === 'QRIS' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                            color: trx.paymentMethod === 'CASH' ? '#059669' : trx.paymentMethod === 'QRIS' ? '#2563eb' : '#7c3aed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {trx.paymentMethod === 'CASH' ? <Banknote size={13} /> : trx.paymentMethod === 'QRIS' ? <Smartphone size={13} /> : <CreditCard size={13} />}
                            Bayar: {trx.paymentMethod === 'CASH' ? 'Cash / Tunai' : trx.paymentMethod === 'QRIS' ? 'QRIS' : 'Kartu Debit/Kredit'}
                          </span>
                        </div>
                      )}
                    </div>

                    {trx.orders && trx.orders.length > 0 ? (
                      <div className="mt-4">
                        <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>Daftar Pesanan:</p>
                        <div className="custom-scrollbar" style={{ height: '180px', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.02)' }}>
                          <ul style={{ paddingLeft: '1rem', marginTop: '0', marginBottom: '0' }}>
                            {trx.orders.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)).map((order, orderIdx) => (
                              <div key={order.id} style={{ marginBottom: '0.5rem' }}>
                                {orderIdx > 0 && <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', margin: '0.25rem 0' }}><Plus size={12} style={{display:'inline', marginRight: '2px'}}/> Pesanan Tambahan</p>}
                                <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                                  {order.items.map(item => (
                                    <li key={item.id} style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                      {item.quantity}x {item.menuItem?.name || 'Item'}
                                      <span style={{ float: 'right' }}>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </ul>
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Total:</span>
                          <span className="text-primary" style={{ fontWeight: 800, fontSize: '1.3rem' }}>
                            Rp {trx.total.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>Daftar Pesanan:</p>
                        <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1rem', background: 'rgba(0,0,0,0.02)' }}>
                          <p style={{ fontStyle: 'italic', opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>Belum ada pesanan.</p>
                        </div>
                      </div>
                    )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-auto pt-4">
                      <button
                        className="btn btn-outline"
                        onClick={() => openEditOrderModal(trx)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem', width: '100%' }}
                      >
                        <Edit3 size={16} style={{ marginRight: '4px' }} /> Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => deleteTransaction(trx.id)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem', width: '100%', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}
                      >
                        <Trash2 size={16} style={{ marginRight: '4px' }} /> Hapus
                      </button>
                    </div>
                  </div>
              ))}
              {archiveTransactions.length === 0 && !loadingArchive && (
                <p>Tidak ada transaksi pada tanggal {archiveDate}.</p>
              )}
            </div>
            </>
          )}
        </div>
      )}

      {/* TAB STATISTIK MEJA, ORDER & PERPUTARAN */}
      {activeTab === 'stats' && (() => {
        const stats = calculateTableStats();
        const formattedDateStr = statsDate 
          ? new Date(statsDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : statsDate;

        // Filter and Sort for Menu Items (Sub-Tab 2)
        const categoriesInStats = Array.from(new Set(stats.itemList.map(i => i.category))).filter(Boolean);
        const filteredStatsItems = stats.itemList
          .filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(statsItemSearch.toLowerCase()) ||
                                  item.category.toLowerCase().includes(statsItemSearch.toLowerCase());
            const matchesCategory = statsItemCategory === 'ALL' || item.category === statsItemCategory;
            return matchesSearch && matchesCategory;
          })
          .sort((a, b) => {
            if (statsItemSort === 'asc') {
              // Paling Tidak Laku -> Paling Laku
              return a.quantity - b.quantity || a.totalRevenue - b.totalRevenue;
            }
            // Paling Laku -> Paling Tidak Laku
            return b.quantity - a.quantity || b.totalRevenue - a.totalRevenue;
          });

        return (
          <div>
            {/* Top Control Bar */}
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4" style={{ background: 'var(--card-bg)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={24} style={{ color: 'var(--primary-color)' }} />
                  Statistik Meja, Order & Penjualan Menu
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                  Analisis perputaran meja (table turnover), jumlah order diterima, dan performa menu paling laku hingga tidak laku.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.03)', padding: '0.35rem 0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <Calendar size={16} style={{ opacity: 0.6 }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter Tanggal:</span>
                  <input
                    type="date"
                    className="input"
                    value={statsDate}
                    onChange={(e) => setStatsDate(e.target.value)}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', borderRadius: '8px' }}
                  />
                </div>

                <button 
                  className="btn btn-outline" 
                  onClick={fetchStats}
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
                >
                  <RefreshCcw size={16} style={{ marginRight: '6px' }} /> Refresh Data
                </button>
              </div>
            </div>

            {loadingStats ? (
              <p style={{ fontStyle: 'italic', opacity: 0.8 }}>Memuat data statistik meja...</p>
            ) : (
              <div>
                {/* 7 Metric KPI Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Card 1: Total Revenue */}
                  <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '1rem 1.15rem', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 700 }}>Revenue Keseluruhan</span>
                      <div style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', padding: '6px', borderRadius: '10px' }}>
                        <TrendingUp size={18} />
                      </div>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#1d4ed8' }}>
                        Rp {stats.totalRevenueOverall.toLocaleString('id-ID')}
                      </h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
                        {formattedDateStr}
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Meja Dipakai & Perputaran */}
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '1rem 1.15rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 700 }}>Meja Dipakai & Perputaran</span>
                      <div style={{ background: 'rgba(5, 150, 105, 0.15)', color: '#059669', padding: '6px', borderRadius: '10px' }}>
                        <RefreshCcw size={18} />
                      </div>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#047857' }}>
                        {stats.distinctTablesUsed} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Meja Dipakai</span>
                      </h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', fontWeight: 600, color: '#047857' }}>
                        {stats.physicalTurnoverCount}x total perputaran ({stats.avgTurnoverPerTable.toFixed(1)}x / meja)
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Total Order Diterima */}
                  <div style={{ background: 'rgba(14, 165, 233, 0.08)', padding: '1rem 1.15rem', borderRadius: '16px', border: '1px solid rgba(14, 165, 233, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#0284c7', fontWeight: 700 }}>Total Order Diterima</span>
                      <div style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', padding: '6px', borderRadius: '10px' }}>
                        <ShoppingBag size={18} />
                      </div>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0369a1' }}>
                        {stats.totalOrdersReceived} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Pesanan</span>
                      </h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', fontWeight: 600, color: '#0369a1' }}>
                        {stats.initialOrdersCount} Utama • {stats.additionalOrdersCount} Tambahan (Avg {stats.avgOrdersPerTable.toFixed(1)}/meja)
                      </p>
                    </div>
                  </div>

                  {/* Card 4: Average Table Duration */}
                  <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '1rem 1.15rem', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#d97706', fontWeight: 700 }}>Avg Durasi Meja</span>
                      <div style={{ background: 'rgba(217, 119, 6, 0.15)', color: '#d97706', padding: '6px', borderRadius: '10px' }}>
                        <Timer size={18} />
                      </div>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#b45309' }}>
                        {formatDuration(stats.avgDurationMsOverall)}
                      </h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
                        Rata-rata waktu terisi -> selesai
                      </p>
                    </div>
                  </div>

                  {/* Card 5: Top Turnover Table */}
                  <div style={{ background: 'rgba(236, 72, 153, 0.08)', padding: '1rem 1.15rem', borderRadius: '16px', border: '1px solid rgba(236, 72, 153, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#db2777', fontWeight: 700 }}>Meja Paling Sering Diputar</span>
                      <div style={{ background: 'rgba(219, 39, 119, 0.15)', color: '#db2777', padding: '6px', borderRadius: '10px' }}>
                        <Utensils size={18} />
                      </div>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#be185d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {stats.topTurnoverTable ? stats.topTurnoverTable.label : '-'}
                      </h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', fontWeight: 700, color: '#be185d' }}>
                        {stats.topTurnoverTable ? `${stats.topTurnoverTable.turnoverCount}x diputar (${stats.topTurnoverTable.totalOrdersCount} order)` : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Card 6: Most Sold Menu Item */}
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '1rem 1.15rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Flame size={14} style={{ color: '#ef4444' }} /> Menu Paling Laku
                      </span>
                      <div style={{ background: 'rgba(5, 150, 105, 0.15)', color: '#059669', padding: '6px', borderRadius: '10px' }}>
                        <TrendingUp size={18} />
                      </div>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#047857', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {stats.mostSoldItem ? stats.mostSoldItem.name : '-'}
                      </h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', fontWeight: 700, color: '#047857' }}>
                        {stats.mostSoldItem ? `${stats.mostSoldItem.quantity}x porsi terjual (Rp ${stats.mostSoldItem.totalRevenue.toLocaleString('id-ID')})` : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Card 7: Least Sold Menu Item */}
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '1rem 1.15rem', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 700 }}>Menu Paling Tidak Laku</span>
                      <div style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', padding: '6px', borderRadius: '10px' }}>
                        <AlertTriangle size={18} />
                      </div>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#b91c1c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {stats.leastSoldItem ? stats.leastSoldItem.name : '-'}
                      </h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c' }}>
                        {stats.leastSoldItem ? `${stats.leastSoldItem.quantity}x porsi terjual (Rp ${stats.leastSoldItem.totalRevenue.toLocaleString('id-ID')})` : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Table Breakdown Details with Sub-Tab Switcher */}
                <div className="glass-card p-5" style={{ borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                  {/* Sub-Tab Navigation Buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setStatsSubTab('tables')}
                        style={{
                          background: statsSubTab === 'tables' ? 'var(--primary-color)' : 'rgba(0,0,0,0.04)',
                          color: statsSubTab === 'tables' ? 'white' : 'var(--text-color)',
                          border: 'none',
                          padding: '0.55rem 1.1rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Utensils size={18} />
                        Rincian Performa & Perputaran Per Meja ({stats.tableList.length})
                      </button>
                      <button
                        onClick={() => setStatsSubTab('items')}
                        style={{
                          background: statsSubTab === 'items' ? 'var(--primary-color)' : 'rgba(0,0,0,0.04)',
                          color: statsSubTab === 'items' ? 'white' : 'var(--text-color)',
                          border: 'none',
                          padding: '0.55rem 1.1rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <BarChart3 size={18} />
                        Urutan Pesanan (Paling Laku s/d Tidak Laku) ({stats.itemList.length})
                      </button>
                      <button
                        onClick={() => setStatsSubTab('hourly')}
                        style={{
                          background: statsSubTab === 'hourly' ? 'var(--primary-color)' : 'rgba(0,0,0,0.04)',
                          color: statsSubTab === 'hourly' ? 'white' : 'var(--text-color)',
                          border: 'none',
                          padding: '0.55rem 1.1rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Clock size={18} />
                        Analisis Jam Sibuk & Per Jam ({stats.activeHoursList.length} Jam Aktif)
                      </button>
                    </div>

                    {statsSubTab === 'tables' && (
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.8, background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', padding: '0.4rem 0.85rem', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        Total Meja Dipakai: <strong>{stats.distinctTablesUsed} Meja</strong> | Perputaran: <strong>{stats.physicalTurnoverCount}x</strong> | Total Order: <strong>{stats.totalOrdersReceived} Pesanan</strong>
                      </div>
                    )}
                  </div>

                  {statsSubTab === 'tables' ? (
                    /* Sub-Tab 1: Table Performance & Turnover */
                    stats.tableList.length > 0 ? (
                      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                              <th style={{ padding: '0.85rem 1rem', width: '50px' }}>No</th>
                              <th style={{ padding: '0.85rem 1rem' }}>Nomor Meja</th>
                              <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Jumlah Perputaran (Turnover)</th>
                              <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Total Order Diterima</th>
                              <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Rata-Rata Durasi Terisi</th>
                              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Revenue Meja</th>
                              <th style={{ padding: '0.85rem 1rem', width: '220px' }}>Kontribusi Revenue (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.tableList.map((item, idx) => (
                              <tr key={item.tableKey} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                <td style={{ padding: '0.8rem 1rem', fontWeight: 600, opacity: 0.6 }}>{idx + 1}</td>
                                <td style={{ padding: '0.8rem 1rem' }}>
                                  <span style={{
                                    background: item.isTakeAway ? '#f59e0b' : 'var(--primary-color)',
                                    color: 'white',
                                    padding: '0.3rem 0.7rem',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                    display: 'inline-block'
                                  }}>
                                    {item.label}
                                  </span>
                                </td>
                                <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
                                  <span style={{
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    color: '#059669',
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '14px',
                                    fontWeight: 800,
                                    fontSize: '0.88rem'
                                  }}>
                                    {item.turnoverCount}x selesai
                                  </span>
                                </td>
                                <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
                                  <span style={{
                                    background: 'rgba(14, 165, 233, 0.12)',
                                    color: '#0284c7',
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '14px',
                                    fontWeight: 800,
                                    fontSize: '0.88rem'
                                  }}>
                                    {item.totalOrdersCount} pesanan
                                  </span>
                                </td>
                                <td style={{ padding: '0.8rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: 0.9 }}>
                                    <Clock size={14} style={{ color: '#d97706' }} />
                                    {formatDuration(item.avgDurationMs)}
                                  </span>
                                </td>
                                <td style={{ padding: '0.8rem 1rem', textAlign: 'right', fontWeight: 800, color: 'var(--primary-color)', fontSize: '0.95rem' }}>
                                  Rp {item.totalRevenue.toLocaleString('id-ID')}
                                </td>
                                <td style={{ padding: '0.8rem 1rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700 }}>
                                      <span>{item.revenueSharePercent.toFixed(1)}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${Math.min(100, Math.max(0, item.revenueSharePercent))}%`,
                                        height: '100%',
                                        background: item.isTakeAway ? '#f59e0b' : 'var(--primary-color)',
                                        borderRadius: '4px',
                                        transition: 'width 0.3s ease'
                                      }} />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'rgba(59, 130, 246, 0.05)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                              <td colSpan={2} style={{ padding: '0.9rem 1rem', fontSize: '0.95rem' }}>TOTAL KESELURUHAN</td>
                              <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: '#059669', fontSize: '1rem' }}>
                                {stats.totalTurnoverCount} Perputaran ({stats.distinctTablesUsed} Meja Fisik)
                              </td>
                              <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: '#0284c7', fontSize: '1rem' }}>
                                {stats.totalOrdersReceived} Order Tiket
                              </td>
                              <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: '#d97706', fontSize: '0.95rem' }}>
                                Avg: {formatDuration(stats.avgDurationMsOverall)}
                              </td>
                              <td style={{ padding: '0.9rem 1rem', textAlign: 'right', color: '#2563eb', fontSize: '1.15rem' }}>
                                Rp {stats.totalRevenueOverall.toLocaleString('id-ID')}
                              </td>
                              <td style={{ padding: '0.9rem 1rem', fontWeight: 800, color: '#2563eb' }}>
                                100%
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontStyle: 'italic', opacity: 0.7, margin: 0, padding: '1.5rem 0', textAlign: 'center' }}>
                        Belum ada transaksi selesai pada tanggal {statsDate}.
                      </p>
                    )
                  ) : statsSubTab === 'items' ? (
                    /* Sub-Tab 2: Menu Item Sales & Ranking (Most Sold to Least Sold) */
                    <div>
                      {/* Filter & Sort Controls */}
                      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.02)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                          {/* Search Input */}
                          <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                            <input
                              type="text"
                              className="input"
                              placeholder="Cari nama menu / item..."
                              value={statsItemSearch}
                              onChange={(e) => setStatsItemSearch(e.target.value)}
                              style={{ paddingLeft: '2.2rem', paddingRight: '0.5rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.85rem', width: '100%' }}
                            />
                          </div>

                          {/* Category Filter */}
                          <select
                            className="input"
                            value={statsItemCategory}
                            onChange={(e) => setStatsItemCategory(e.target.value)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', borderRadius: '8px', minWidth: '160px' }}
                          >
                            <option value="ALL">Semua Kategori ({stats.itemList.length})</option>
                            {categoriesInStats.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>

                          {/* Sort Toggle Button */}
                          <button
                            onClick={() => setStatsItemSort(prev => prev === 'desc' ? 'asc' : 'desc')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '0.4rem 0.85rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              background: statsItemSort === 'desc' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: statsItemSort === 'desc' ? '#059669' : '#dc2626',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              cursor: 'pointer'
                            }}
                          >
                            {statsItemSort === 'desc' ? <Flame size={16} /> : <AlertTriangle size={16} />}
                            {statsItemSort === 'desc' ? 'Urutan: Paling Laku → Tidak Laku' : 'Urutan: Paling Tidak Laku → Laku'}
                            <ArrowUpDown size={14} style={{ marginLeft: '4px' }} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem', fontWeight: 700 }}>
                          <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '0.25rem 0.6rem', borderRadius: '8px' }}>
                            🔥 {stats.itemList.filter(i => i.quantity > 0).length} Menu Terjual
                          </span>
                          <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', padding: '0.25rem 0.6rem', borderRadius: '8px' }}>
                            ❄️ {stats.itemList.filter(i => i.quantity === 0).length} Belum Terjual
                          </span>
                        </div>
                      </div>

                      {filteredStatsItems.length > 0 ? (
                        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                <th style={{ padding: '0.85rem 1rem', width: '60px' }}>Peringkat</th>
                                <th style={{ padding: '0.85rem 1rem' }}>Status / Level Laku</th>
                                <th style={{ padding: '0.85rem 1rem' }}>Nama Makanan / Item</th>
                                <th style={{ padding: '0.85rem 1rem' }}>Kategori</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Total Terjual (Porsi)</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Frekuensi Dipesan</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Harga Satuan</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Revenue (Rp)</th>
                                <th style={{ padding: '0.85rem 1rem', width: '200px' }}>Kontribusi Revenue (%)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredStatsItems.map((item, idx) => {
                                const rank = statsItemSort === 'desc' ? idx + 1 : filteredStatsItems.length - idx;
                                const isUnsold = item.quantity === 0;
                                const isTop3 = statsItemSort === 'desc' && idx < 3 && item.quantity > 0;

                                return (
                                  <tr key={item.name + idx} style={{ borderBottom: '1px solid var(--border-color)', background: isUnsold ? 'rgba(239, 68, 68, 0.02)' : idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                    <td style={{ padding: '0.8rem 1rem', fontWeight: 800, opacity: 0.7, fontSize: '0.95rem' }}>
                                      #{rank}
                                    </td>
                                    <td style={{ padding: '0.8rem 1rem' }}>
                                      {isUnsold ? (
                                        <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', padding: '3px 8px', borderRadius: '8px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          ❄️ Belum Terjual (0 Porsi)
                                        </span>
                                      ) : isTop3 ? (
                                        <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#059669', padding: '3px 8px', borderRadius: '8px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          🔥 Paling Laku #{rank}
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', padding: '3px 8px', borderRadius: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          👍 Terjual ({item.quantity}x)
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.8rem 1rem', fontWeight: 700 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {item.image ? (
                                          <img
                                            src={item.image}
                                            alt={item.name}
                                            style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }}
                                          />
                                        ) : (
                                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexShrink: 0 }}>
                                            <Utensils size={18} />
                                          </div>
                                        )}
                                        <span>{item.name}</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.8rem 1rem', opacity: 0.8 }}>
                                      <span style={{ background: 'rgba(0,0,0,0.05)', padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                                        {item.category}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
                                      <span style={{
                                        background: isUnsold ? 'rgba(0,0,0,0.05)' : 'rgba(59, 130, 246, 0.12)',
                                        color: isUnsold ? '#9ca3af' : '#2563eb',
                                        padding: '0.3rem 0.75rem',
                                        borderRadius: '14px',
                                        fontWeight: 800,
                                        fontSize: '0.88rem'
                                      }}>
                                        {item.quantity}x porsi
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.8rem 1rem', textAlign: 'center', opacity: isUnsold ? 0.5 : 0.9 }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {item.orderCount > 0 ? `${item.orderCount} Order Tiket` : '-'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.8rem 1rem', textAlign: 'right', opacity: 0.8 }}>
                                      Rp {item.unitPrice.toLocaleString('id-ID')}
                                    </td>
                                    <td style={{ padding: '0.8rem 1rem', textAlign: 'right', fontWeight: 800, color: isUnsold ? '#9ca3af' : 'var(--primary-color)', fontSize: '0.95rem' }}>
                                      Rp {item.totalRevenue.toLocaleString('id-ID')}
                                    </td>
                                    <td style={{ padding: '0.8rem 1rem' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700 }}>
                                          <span>{item.revenueSharePercent.toFixed(1)}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                          <div style={{
                                            width: `${Math.min(100, Math.max(0, item.revenueSharePercent))}%`,
                                            height: '100%',
                                            background: isUnsold ? '#cbd5e1' : isTop3 ? '#10b981' : 'var(--primary-color)',
                                            borderRadius: '4px',
                                            transition: 'width 0.3s ease'
                                          }} />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: 'rgba(59, 130, 246, 0.05)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                                <td colSpan={4} style={{ padding: '0.9rem 1rem', fontSize: '0.95rem' }}>TOTAL KESELURUHAN ({filteredStatsItems.length} Menu)</td>
                                <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: '#059669', fontSize: '1rem' }}>
                                  {filteredStatsItems.reduce((sum, i) => sum + i.quantity, 0)} Porsi
                                </td>
                                <td></td>
                                <td></td>
                                <td style={{ padding: '0.9rem 1rem', textAlign: 'right', color: '#2563eb', fontSize: '1.15rem' }}>
                                  Rp {filteredStatsItems.reduce((sum, i) => sum + i.totalRevenue, 0).toLocaleString('id-ID')}
                                </td>
                                <td style={{ padding: '0.9rem 1rem', fontWeight: 800, color: '#2563eb' }}>
                                  100%
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <p style={{ fontStyle: 'italic', opacity: 0.7, margin: 0, padding: '1.5rem 0', textAlign: 'center' }}>
                          Tidak ada menu yang sesuai dengan pencarian / filter "{statsItemSearch}".
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Sub-Tab 3: Hourly Peak & Activity Analysis */
                    <div>
                      {/* Peak Hour Summary Card Banner */}
                      {stats.peakHour && (
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#f59e0b', color: 'white', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Flame size={22} />
                            </div>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#b45309' }}>
                                Jam Paling Sibuk Hari Ini: {stats.peakHour.label} (Jam {stats.peakHour.hour} Siang/Malam)
                              </h4>
                              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                                Menerima <strong>{stats.peakHour.orderCount} Order Tiket</strong> • <strong>{stats.peakHour.totalItemsQuantity} Porsi Menu Dipesan</strong> • <strong>{stats.peakHour.tablesCount} Meja Dipakai</strong> (Total Revenue: Rp {stats.peakHour.totalRevenue.toLocaleString('id-ID')})
                              </p>
                            </div>
                          </div>
                          <button
                            className="btn btn-outline"
                            onClick={() => setSelectedHourFilter(stats.peakHour.hour)}
                            style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem', background: 'white', border: '1px solid #f59e0b', color: '#b45309', fontWeight: 700 }}
                          >
                            Lihat Jam Paling Sibuk Ini
                          </button>
                        </div>
                      )}

                      {/* Hourly Filter Selector */}
                      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(0,0,0,0.02)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <Clock size={18} style={{ opacity: 0.6 }} />
                        <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Pilih Filter Jam:</span>
                        <select
                          className="input"
                          value={selectedHourFilter}
                          onChange={(e) => setSelectedHourFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.88rem', borderRadius: '8px', minWidth: '240px', fontWeight: 600 }}
                        >
                          <option value="ALL">Semua Jam Oprik ({stats.activeHoursList.length} Jam dengan Transaksi)</option>
                          {stats.hourlyList.map(h => (
                            <option key={h.hour} value={h.hour}>
                              {h.label} {h.orderCount > 0 ? `(${h.orderCount} Order, ${h.totalItemsQuantity} Porsi, ${h.tablesCount} Meja)` : '(Tidak Ada Transaksi)'}
                            </option>
                          ))}
                        </select>
                        {selectedHourFilter !== 'ALL' && (
                          <button
                            className="btn btn-outline"
                            onClick={() => setSelectedHourFilter('ALL')}
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                          >
                            Reset Filter Jam
                          </button>
                        )}
                      </div>

                      {/* Main Table for Hourly Activity Breakdown */}
                      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                              <th style={{ padding: '0.85rem 1rem', width: '60px' }}>Jam</th>
                              <th style={{ padding: '0.85rem 1rem' }}>Rentang Waktu</th>
                              <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Order Diterima</th>
                              <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Menu Dipesan (Porsi)</th>
                              <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Meja Dipakai</th>
                              <th style={{ padding: '0.85rem 1rem' }}>Daftar Meja Aktif</th>
                              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Revenue Per Jam</th>
                              <th style={{ padding: '0.85rem 1rem', textAlign: 'center', width: '130px' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedHourFilter === 'ALL' ? stats.hourlyList.filter(h => h.orderCount > 0) : stats.hourlyList.filter(h => h.hour === selectedHourFilter)).map((h) => {
                              const isPeak = stats.peakHour && stats.peakHour.hour === h.hour;
                              const isSelected = selectedHourFilter === h.hour;

                              return (
                                <tr key={h.hour} style={{ borderBottom: '1px solid var(--border-color)', background: isSelected ? 'rgba(59, 130, 246, 0.08)' : isPeak ? 'rgba(245, 158, 11, 0.05)' : 'transparent' }}>
                                  <td style={{ padding: '0.85rem 1rem', fontWeight: 800, fontSize: '0.95rem' }}>
                                    {String(h.hour).padStart(2, '0')}:00
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span>{h.label}</span>
                                      {isPeak && (
                                        <span style={{ fontSize: '0.72rem', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: '6px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                          <Flame size={12} /> Jam Paling Sibuk
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                    <span style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7', padding: '0.3rem 0.75rem', borderRadius: '14px', fontWeight: 800, fontSize: '0.88rem' }}>
                                      {h.orderCount} Order Tiket
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                    <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '0.3rem 0.75rem', borderRadius: '14px', fontWeight: 800, fontSize: '0.88rem' }}>
                                      {h.totalItemsQuantity} Porsi Menu
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                    <span style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed', padding: '0.3rem 0.75rem', borderRadius: '14px', fontWeight: 800, fontSize: '0.88rem' }}>
                                      {h.tablesCount} Meja Dipakai
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem' }}>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                      {h.tableList.map(t => (
                                        <span key={t.tableKey} style={{ background: t.isTakeAway ? '#f59e0b' : 'var(--primary-color)', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                          {t.label} ({t.orderCount}o, {t.totalItemsQuantity}p)
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: 'var(--primary-color)', fontSize: '0.95rem' }}>
                                    Rp {h.totalRevenue.toLocaleString('id-ID')}
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                    <button
                                      className="btn btn-outline"
                                      onClick={() => setSelectedHourFilter(h.hour)}
                                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', borderRadius: '8px' }}
                                    >
                                      Detail Jam
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {stats.activeHoursList.length === 0 && (
                              <tr>
                                <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', fontStyle: 'italic', opacity: 0.7 }}>
                                  Belum ada transaksi / order pada tanggal {statsDate}.
                                </td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'rgba(59, 130, 246, 0.05)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                              <td colSpan={2} style={{ padding: '0.9rem 1rem', fontSize: '0.95rem' }}>TOTAL KESELURUHAN (24 JAM)</td>
                              <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: '#0284c7', fontSize: '1rem' }}>
                                {stats.totalOrdersReceived} Order
                              </td>
                              <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: '#059669', fontSize: '1rem' }}>
                                {stats.itemList.reduce((sum, i) => sum + i.quantity, 0)} Porsi
                              </td>
                              <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: '#7c3aed', fontSize: '1rem' }}>
                                {stats.distinctTablesUsed} Meja Fisik
                              </td>
                              <td></td>
                              <td style={{ padding: '0.9rem 1rem', textAlign: 'right', color: '#2563eb', fontSize: '1.15rem' }}>
                                Rp {stats.totalRevenueOverall.toLocaleString('id-ID')}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Drilldown Detailed View for Selected Hour */}
                      {selectedHourFilter !== 'ALL' && (() => {
                        const targetHourData = stats.hourlyList.find(h => h.hour === selectedHourFilter);
                        if (!targetHourData) return null;

                        return (
                          <div style={{ background: 'rgba(59, 130, 246, 0.04)', border: '2px solid rgba(59, 130, 246, 0.2)', borderRadius: '16px', padding: '1.25rem', marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                              <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Clock size={20} />
                                  Rincian Detail Transaksi Pada: {targetHourData.label} (Jam {targetHourData.hour} Siang/Malam)
                                </h3>
                                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', opacity: 0.8 }}>
                                  Menerima <strong>{targetHourData.orderCount} Order Tiket</strong>, <strong>{targetHourData.totalItemsQuantity} Porsi Menu Dipesan</strong>, dan <strong>{targetHourData.tablesCount} Meja Beraktivitas</strong> (Total Omset Jam Ini: Rp {targetHourData.totalRevenue.toLocaleString('id-ID')}).
                                </p>
                              </div>
                              <button
                                className="btn btn-outline"
                                onClick={() => setSelectedHourFilter('ALL')}
                                style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
                              >
                                <X size={14} style={{ marginRight: '4px' }} /> Tutup Detail Jam
                              </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                              {/* Panel 1: Menu Items Ordered in this hour */}
                              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Utensils size={16} /> Daftar Menu & Porsi Dipesan (Jam {targetHourData.hour}:00)
                                </h4>
                                {targetHourData.itemList.length > 0 ? (
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                      <thead>
                                        <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                          <th style={{ padding: '0.5rem 0.75rem' }}>Nama Menu</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Jumlah Porsi</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total Omset</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {targetHourData.itemList.map((item, i) => (
                                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>
                                              {item.name}
                                              <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, fontWeight: 400 }}>{item.category}</span>
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                              <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '0.2rem 0.5rem', borderRadius: '10px', fontWeight: 800 }}>
                                                {item.quantity}x porsi
                                              </span>
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary-color)' }}>
                                              Rp {item.totalRevenue.toLocaleString('id-ID')}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.7 }}>Tidak ada menu dipesan pada jam ini.</p>
                                )}
                              </div>

                              {/* Panel 2: Tables Active in this hour */}
                              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <ShoppingBag size={16} /> Meja Dipakai & Aktivitas Order (Jam {targetHourData.hour}:00)
                                </h4>
                                {targetHourData.tableList.length > 0 ? (
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                      <thead>
                                        <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                          <th style={{ padding: '0.5rem 0.75rem' }}>Nomor Meja</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Aktivitas Order</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Total Porsi</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total Omset Meja</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {targetHourData.tableList.map((tbl, i) => (
                                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>
                                              <span style={{ background: tbl.isTakeAway ? '#f59e0b' : 'var(--primary-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem' }}>
                                                {tbl.label}
                                              </span>
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                              <span style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7', padding: '0.2rem 0.5rem', borderRadius: '10px', fontWeight: 800 }}>
                                                {tbl.orderCount} Order
                                              </span>
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>
                                              {tbl.totalItemsQuantity} Porsi
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary-color)' }}>
                                              Rp {tbl.totalRevenue.toLocaleString('id-ID')}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.7 }}>Tidak ada meja beraktivitas pada jam ini.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 2: KELOLA MENU & FOTO */}
      {activeTab === 'menu' && (
        <div>
          <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <h2>Daftar Menu Restoran</h2>
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
              {currentUser?.role === 'ADMIN' && (
                <div className="flex gap-2">
                  <button className="btn btn-outline" onClick={() => setShowCategoryModal(true)}>
                    <Sliders size={18} style={{ marginRight: '8px' }} /> Kelola Kategori Menu
                  </button>
                  <button className="btn btn-primary" onClick={openAddModal}>
                    <Plus size={18} style={{ marginRight: '8px' }} /> Tambah Menu Baru
                  </button>
                </div>
              )}
            </div>
          </div>

          {loadingMenu ? (
            <p>Memuat daftar menu...</p>
          ) : (
            <div className="grid grid-cols-3">
              {filteredMenu.map(item => (
                <div key={item.id} className="glass-card flex flex-col justify-between" style={{ overflow: 'hidden', padding: 0 }}>
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
                    <div className="flex justify-between items-start">
                      <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>{item.name}</h3>
                      {!item.isAvailable && (
                        <span style={{ background: '#ef4444', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                          Habis
                        </span>
                      )}
                    </div>
                    <p className="text-primary" style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: 0, opacity: item.isAvailable ? 1 : 0.5 }}>
                      Rp {item.price.toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2" style={{ padding: '0 1.25rem 1.25rem 1.25rem' }}>
                    {currentUser?.role === 'ADMIN' ? (
                      <>
                        <div className="flex gap-2">
                          <button className="btn btn-outline" style={{ flex: 1, padding: '0.4rem' }} onClick={() => openEditModal(item)}>
                            <Edit3 size={16} style={{ marginRight: '6px' }} /> Edit
                          </button>
                          <button className="btn btn-danger" style={{ padding: '0.4rem 0.75rem' }} onClick={() => handleDeleteMenu(item.id, item.name)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <button 
                          className={`btn ${item.isAvailable ? 'btn-outline' : 'btn-primary'}`} 
                          style={{ padding: '0.4rem', width: '100%', borderColor: item.isAvailable ? '#ef4444' : '', color: item.isAvailable ? '#ef4444' : '' }} 
                          onClick={() => handleToggleAvailability(item)}
                        >
                          <X size={16} style={{ marginRight: '6px' }} /> {item.isAvailable ? 'Close Order (Stok Habis)' : 'Buka Order (Tersedia)'}
                        </button>
                      </>
                    ) : (
                      <div style={{ padding: '0.4rem 0', opacity: 0.6, fontSize: '0.85rem' }}>Hanya Admin yang dapat mengedit menu</div>
                    )}
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
                      <div className="flex justify-between items-center mb-1">
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>
                          Kategori
                        </label>
                        <button 
                          type="button" 
                          style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          onClick={() => setShowCategoryModal(true)}
                        >
                          + Kelola / Tambah Kategori
                        </button>
                      </div>
                      <select
                        className="input"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                      >
                        {[...new Set([
                          ...categoriesList.map(c => c.name),
                          ...menuList.map(m => m.category).filter(Boolean),
                          'Makanan', 'Minuman', 'Dessert', 'Cemilan', 'Tambahan', 'Umum'
                        ])].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
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

      {/* TAB: KELOLA KARYAWAN (ADMIN ONLY) */}
      {activeTab === 'employees' && currentUser?.role === 'ADMIN' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2>Manajemen Karyawan & Kasir</h2>
            <button className="btn btn-primary" onClick={() => {
              setEditingEmployeeId(null);
              setEmployeeFormData({ username: '', password: '', name: '', ttl: '', phone: '', address: '' });
              setEmployeeError('');
              setShowEmployeeModal(true);
            }}>
              <Plus size={18} style={{ marginRight: '8px' }} /> Tambah Kasir Baru
            </button>
          </div>

          {loadingEmployees ? (
            <p>Memuat daftar karyawan...</p>
          ) : (
            <div className="grid grid-cols-2">
              {employees.map(emp => (
                <div key={emp.id} className="glass-card flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{emp.name || emp.username}</span>
                      <span className="badge" style={{ background: emp.role === 'ADMIN' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: emp.role === 'ADMIN' ? 'var(--primary-color)' : '#10b981' }}>
                        {emp.role}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>ID:</strong> {emp.employeeId}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>Username:</strong> {emp.username}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>TTL:</strong> {emp.ttl || '-'}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>No HP:</strong> {emp.phone || '-'}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>Alamat:</strong> {emp.address || '-'}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6, marginTop: '0.5rem' }}>Terdaftar: {new Date(emp.createdAt).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="btn btn-outline" style={{ flex: 1, padding: '0.4rem' }} onClick={() => {
                      setEditingEmployeeId(emp.id);
                      setEmployeeFormData({
                        username: emp.username,
                        password: '', // Blank when editing
                        name: emp.name || '',
                        ttl: emp.ttl || '',
                        phone: emp.phone || '',
                        address: emp.address || ''
                      });
                      setEmployeeError('');
                      setShowEmployeeModal(true);
                    }}>
                      <Edit3 size={16} style={{ marginRight: '6px' }} /> Edit Data
                    </button>
                    {emp.role !== 'ADMIN' && (
                      <button className="btn btn-danger" style={{ flex: 1, padding: '0.4rem' }} onClick={() => handleDeleteEmployee(emp.id)}>
                        <Trash2 size={16} style={{ marginRight: '6px' }} /> Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal Add Employee */}
          {showEmployeeModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-color)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3>{editingEmployeeId ? 'Edit Data Karyawan' : 'Tambah Akun Karyawan (Kasir)'}</h3>
                  <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowEmployeeModal(false)}><X size={18} /></button>
                </div>
                {employeeError && <div style={{ padding: '0.6rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{employeeError}</div>}
                <form onSubmit={handleSaveEmployee} className="flex flex-col gap-3">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Nama Lengkap *</label>
                    <input type="text" className="input" value={employeeFormData.name} onChange={(e) => setEmployeeFormData({...employeeFormData, name: e.target.value})} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Username Login *</label>
                    <input type="text" className="input" placeholder="contoh: budi_kasir" value={employeeFormData.username} onChange={(e) => setEmployeeFormData({...employeeFormData, username: e.target.value.toLowerCase()})} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Password {editingEmployeeId ? '(Kosongkan jika tidak ingin diubah)' : 'Awal (Default: kasir123)'}</label>
                    <input type="text" className="input" placeholder={editingEmployeeId ? "Kosongkan jika tetap" : "kasir123"} value={employeeFormData.password} onChange={(e) => setEmployeeFormData({...employeeFormData, password: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Tempat, Tanggal Lahir</label>
                      <input type="text" className="input" placeholder="Jakarta, 12 Mei 1998" value={employeeFormData.ttl} onChange={(e) => setEmployeeFormData({...employeeFormData, ttl: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>No Handphone</label>
                      <input type="text" className="input" placeholder="0812..." value={employeeFormData.phone} onChange={(e) => setEmployeeFormData({...employeeFormData, phone: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Alamat Lengkap</label>
                    <textarea className="input" rows={2} value={employeeFormData.address} onChange={(e) => setEmployeeFormData({...employeeFormData, address: e.target.value})} />
                  </div>
                  <div className="flex gap-4 justify-between mt-2">
                    <button type="button" className="btn btn-outline" style={{ width: '40%' }} onClick={() => setShowEmployeeModal(false)}>Batal</button>
                    <button type="submit" className="btn btn-primary" style={{ width: '60%' }}>Simpan Akun</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Change Password */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-color)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Key size={20} /> Ganti Password</h3>
              <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowPasswordModal(false)}><X size={18} /></button>
            </div>
            {passwordError && <div style={{ padding: '0.6rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{passwordError}</div>}
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Password Lama *</label>
                <input type="password" className="input" value={passwordForm.oldPassword} onChange={(e) => setPasswordForm({...passwordForm, oldPassword: e.target.value})} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Password Baru *</label>
                <input type="password" className="input" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Konfirmasi Password Baru *</label>
                <input type="password" className="input" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-primary mt-2">Simpan Password Baru</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Kategori Menu */}
      {showCategoryModal && (
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
          <div className="glass-card" style={{ width: '100%', maxWidth: '550px', background: 'var(--bg-color)', position: 'relative' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={20} /> Kelola Urutan & Kategori Menu
              </h3>
              <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowCategoryModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px dashed var(--primary-color)',
              borderRadius: '10px',
              padding: '0.65rem 0.85rem',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <GripVertical size={20} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
              <span>
                <strong>Geser / Drag & Drop</strong> baris kategori ke atas atau ke bawah untuk mengubah urutannya dengan mudah.
              </span>
            </div>

            {categoryModalError && (
              <div style={{
                padding: '0.6rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                {categoryModalError}
              </div>
            )}

            {/* Form Tambah Kategori Baru */}
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
              <input
                type="text"
                className="input"
                placeholder="Nama kategori baru (misal: Minuman, Dessert)..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                <Plus size={16} style={{ marginRight: '4px' }} /> Tambah
              </button>
            </form>

            {/* List Categories with Drag & Drop */}
            <div 
              ref={categoryListRef}
              className="custom-scrollbar" 
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ 
                maxHeight: '380px', 
                overflowY: 'auto', 
                border: '1px solid var(--border-color)', 
                borderRadius: '10px', 
                padding: '0.5rem', 
                background: 'rgba(0,0,0,0.02)',
                userSelect: 'none'
              }}
            >
              {categoriesList.length === 0 ? (
                <p style={{ fontStyle: 'italic', textAlign: 'center', opacity: 0.7, padding: '1rem' }}>Belum ada kategori.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {categoriesList.map((cat, idx) => {
                    const isBeingDragged = draggedCategoryIdx === idx || touchDraggingIdx === idx;
                    return (
                      <div
                        key={cat.id || cat.name || idx}
                        data-category-index={idx}
                        draggable
                        onDragStart={(e) => handleCategoryDragStart(e, idx)}
                        onDragOver={(e) => handleCategoryDragOver(e, idx)}
                        onDragEnd={handleCategoryDragEnd}
                        onTouchStart={(e) => handleTouchStart(e, idx)}
                        className="flex justify-between items-center p-2.5"
                        style={{
                          background: isBeingDragged ? 'rgba(99, 102, 241, 0.15)' : 'var(--card-bg)',
                          borderRadius: '10px',
                          border: isBeingDragged ? '2px dashed var(--primary-color)' : '1px solid var(--border-color)',
                          cursor: 'grab',
                          transition: 'background 0.15s ease, border 0.15s ease',
                          transform: isBeingDragged ? 'scale(1.01)' : 'scale(1)',
                          boxShadow: isBeingDragged ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div style={{ cursor: 'grab', color: 'var(--primary-color)', opacity: 0.8, display: 'flex', alignItems: 'center' }}>
                            <GripVertical size={20} />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary-color)', minWidth: '22px' }}>
                            #{idx + 1}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{cat.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: '0.75rem', opacity: 0.6, fontStyle: 'italic', paddingRight: '0.5rem' }}>
                            Geser ↕
                          </span>
                          {currentUser?.role === 'ADMIN' && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: '0.25rem 0.55rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(cat);
                              }}
                              title="Hapus Kategori"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button className="btn btn-primary" onClick={() => setShowCategoryModal(false)}>
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
}
