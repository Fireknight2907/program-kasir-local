const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const cat = await prisma.category.create({
      data: { name: 'Minuman', order: 1 }
    });
    console.log('Created category:', cat);

    const cats = await prisma.category.findMany();
    console.log('Categories:', cats);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
