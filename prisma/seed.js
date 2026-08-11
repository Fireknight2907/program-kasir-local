const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.menuItem.count();
  if (count > 0) {
    console.log('Database already seeded.');
    return;
  }

  await prisma.menuItem.createMany({
    data: [
      { name: 'Nasi Goreng Spesial', price: 25000, category: 'Makanan' },
      { name: 'Mie Goreng Seafood', price: 28000, category: 'Makanan' },
      { name: 'Sate Ayam Madura', price: 30000, category: 'Makanan' },
      { name: 'Ayam Bakar Taliwang', price: 35000, category: 'Makanan' },
      { name: 'Es Teh Manis', price: 5000, category: 'Minuman' },
      { name: 'Es Jeruk', price: 8000, category: 'Minuman' },
      { name: 'Kopi Susu', price: 12000, category: 'Minuman' },
      { name: 'Jus Alpukat', price: 15000, category: 'Minuman' },
      { name: 'Kerupuk', price: 2000, category: 'Tambahan' },
    ],
  });

  console.log('Database seeded with initial menu items.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
