const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Seed Admin User
  const adminExists = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (!adminExists) {
    await prisma.user.create({
      data: {
        username: 'admin',
        password: 'admin123',
        name: 'Administrator Kasir',
        role: 'ADMIN',
      },
    });
    console.log('Admin account created (admin / admin123).');
  }

  const count = await prisma.menuItem.count();
  if (count === 0) {
    await prisma.menuItem.createMany({
      data: [
        { name: 'Nasi Goreng Spesial', price: 25000, category: 'Makanan', image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80' },
        { name: 'Mie Goreng Seafood', price: 28000, category: 'Makanan', image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80' },
        { name: 'Sate Ayam Madura', price: 30000, category: 'Makanan', image: 'https://images.unsplash.com/photo-1529563021893-cc83c992d75d?auto=format&fit=crop&w=600&q=80' },
        { name: 'Ayam Bakar Taliwang', price: 35000, category: 'Makanan', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80' },
        { name: 'Es Teh Manis', price: 5000, category: 'Minuman', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80' },
        { name: 'Es Jeruk', price: 8000, category: 'Minuman', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80' },
        { name: 'Kopi Susu', price: 12000, category: 'Minuman', image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80' },
        { name: 'Jus Alpukat', price: 15000, category: 'Minuman', image: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?auto=format&fit=crop&w=600&q=80' },
        { name: 'Kerupuk', price: 2000, category: 'Tambahan', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80' },
      ],
    });
    console.log('Database seeded with initial menu items.');
  } else {
    console.log('Menu items already exist.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
