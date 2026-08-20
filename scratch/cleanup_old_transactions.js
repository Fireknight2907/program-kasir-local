/**
 * Script untuk membersihkan transaksi lama yang masih "open"
 * Semua transaksi open yang lebih dari 1 hari akan ditandai sebagai "cancelled"
 * 
 * Jalankan dengan: node scratch/cleanup_old_transactions.js
 */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Tampilkan semua transaksi yang masih open/ordered
  const allActive = await p.transaction.findMany({
    where: { status: { in: ['open', 'ordered'] } },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\n=== Transaksi aktif di database: ${allActive.length} ===`);
  allActive.forEach(t => {
    const age = Math.round((Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60));
    console.log(`  ID: ${t.id}`);
    console.log(`  Meja: ${t.tableNumber || '(kosong)'} | Status: ${t.status} | Umur: ${age} jam`);
    console.log('');
  });

  // Transaksi yang lebih dari 24 jam dan masih open = sudah stale
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stale = allActive.filter(t => new Date(t.createdAt) < oneDayAgo);

  if (stale.length === 0) {
    console.log('Tidak ada transaksi stale yang perlu dibersihkan.');
    await p.$disconnect();
    return;
  }

  console.log(`\n=== ${stale.length} transaksi stale (>24 jam) akan dibatalkan ===`);
  stale.forEach(t => {
    console.log(`  - Meja ${t.tableNumber || '(kosong)'} | ${t.id}`);
  });

  const ids = stale.map(t => t.id);
  const result = await p.transaction.updateMany({
    where: { id: { in: ids } },
    data: { status: 'cancelled' }
  });

  console.log(`\n✅ ${result.count} transaksi berhasil dibatalkan.`);
  console.log('Sekarang kamu bisa membuat transaksi baru untuk meja yang sama.\n');

  await p.$disconnect();
}

main().catch(e => { 
  console.error('ERROR:', e.message); 
  process.exit(1); 
});
