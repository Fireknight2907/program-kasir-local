const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check the active transaction query logic 
  const dateParam = '2026-08-20';
  
  const startDate = new Date(dateParam);
  startDate.setUTCHours(-8, 0, 0, 0);
  
  const endDate = new Date(dateParam);
  endDate.setUTCHours(23 - 8, 59, 59, 999);

  console.log('startDate:', startDate.toISOString());
  console.log('endDate:', endDate.toISOString());
  
  // Check: Does setUTCHours(-8) work correctly?
  const testDate = new Date('2026-08-20');
  testDate.setUTCHours(-8, 0, 0, 0);
  console.log('Test with -8 hours:', testDate.toISOString()); // Should be 2026-08-19T16:00:00Z

  // Query active transactions like the API does
  const transactions = await p.transaction.findMany({
    where: {
      OR: [
        { status: 'open' },
        { status: 'ordered' },
        {
          createdAt: {
            gte: startDate,
            lte: endDate,
          }
        }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('\nActive transactions found:', transactions.length);
  transactions.forEach(t => {
    console.log(`  - ${t.id} | meja: ${t.tableNumber} | status: ${t.status} | created: ${t.createdAt}`);
  });

  // Now try what happens when meja 2 already exists (from screenshot, user tried meja 2)
  const activeWithSameTable = await p.transaction.findMany({
    where: {
      status: { in: ['open', 'ordered'] }
    }
  });
  console.log('\nAll open/ordered transactions:');
  activeWithSameTable.forEach(t => {
    console.log(`  - ${t.id} | meja: ${t.tableNumber} | status: ${t.status}`);
  });

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
