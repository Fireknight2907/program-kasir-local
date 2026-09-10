const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function ensureAdmin() {
  if (await prisma.user.count({where:{role:'ADMIN'}})) return;
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !/^[a-z0-9_.-]{3,32}$/.test(username) || !password || password.length<10 || Buffer.byteLength(password)>72 || !/[a-zA-Z]/.test(password) || !/[^a-zA-Z]/.test(password) || ['password123','1234567890'].includes(password.toLowerCase())) throw new Error('Isi INITIAL_ADMIN_USERNAME dan INITIAL_ADMIN_PASSWORD yang kuat sebelum seed pertama.');
  await prisma.user.create({data:{username,password:await bcrypt.hash(password,12),name:'Administrator',role:'ADMIN'}});
  console.log('Akun admin dibuat.');
}
ensureAdmin().catch(()=>{console.error('Seed admin gagal. Periksa konfigurasi dan koneksi.');process.exitCode=1;}).finally(()=>prisma.$disconnect());
