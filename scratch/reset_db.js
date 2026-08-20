const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.category.deleteMany();
  console.log('Categories reset.');
  await prisma.$disconnect();
}
run();
