/**
 * Test membuat transaksi baru via Prisma langsung
 * Verifikasi bahwa tidak ada lagi halangan setelah cleanup
 */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check remaining active transactions
  const remaining = await p.transaction.findMany({
    where: { status: { in: ['open', 'ordered'] } }
  });
  console.log(`\nTransaksi aktif tersisa: ${remaining.length}`);
  remaining.forEach(t => {
    console.log(`  - Meja ${t.tableNumber || '(kosong)'} | ${t.status} | ${t.id}`);
  });

  // Try creating meja 1 and 2 (should now work)
  console.log('\n--- Testing buat Meja 1 ---');
  try {
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = `MEJA-1-${Date.now().toString(36).toUpperCase()}-${suffix}`;
    const t = await p.transaction.create({
      data: { id, tableNumber: '1', status: 'open' }
    });
    console.log('✅ Meja 1 berhasil dibuat:', t.id);
    await p.transaction.delete({ where: { id: t.id } });
    console.log('✅ Cleanup test meja 1 OK');
  } catch (e) {
    console.error('❌ Gagal buat Meja 1:', e.message);
  }

  console.log('\n--- Testing buat Meja 2 ---');
  try {
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = `MEJA-2-${Date.now().toString(36).toUpperCase()}-${suffix}`;
    const t = await p.transaction.create({
      data: { id, tableNumber: '2', status: 'open' }
    });
    console.log('✅ Meja 2 berhasil dibuat:', t.id);
    await p.transaction.delete({ where: { id: t.id } });
    console.log('✅ Cleanup test meja 2 OK');
  } catch (e) {
    console.error('❌ Gagal buat Meja 2:', e.message);
  }

  // Summary of all transactions in DB
  const allTrx = await p.transaction.count();
  const menuCount = await p.menuItem.count();
  console.log(`\n=== Ringkasan DB ===`);
  console.log(`Total transaksi: ${allTrx}`);
  console.log(`Total menu: ${menuCount}`);
  
  await p.$disconnect();
}

main().catch(e => { 
  console.error('ERROR:', e.message); 
  process.exit(1); 
});
