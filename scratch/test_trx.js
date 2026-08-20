const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function clean() {
  await prisma.transaction.deleteMany({ where: { id: { startsWith: 'MEJA-1-MT15TL1A' } } });
  console.log('Cleaned test transaction.');
  await prisma.$disconnect();
}
clean();
