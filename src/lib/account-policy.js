export function passwordError(value) {
  if (typeof value !== 'string' || value.length < 10 || new TextEncoder().encode(value).length > 72) return 'Password harus 10–72 byte (minimal 10 karakter).';
  if (['admin123', 'kasir123', 'password123', '1234567890'].includes(value.toLowerCase()) || !/[a-zA-Z]/.test(value) || !/[^a-zA-Z]/.test(value)) return 'Gunakan gabungan huruf dan angka atau simbol; jangan gunakan password bawaan.';
  return null;
}
export function accountData(body, creating = false) {
  const data = {};
  for (const [field, max] of Object.entries({ name: 100, ttl: 100, phone: 30, address: 500 })) {
    if (creating || body[field] !== undefined) {
      if (creating && field !== 'name' && body[field] === undefined) { data[field] = ''; continue; }
      if (typeof body[field] !== 'string' || body[field].length > max || (field === 'name' && !body[field].trim())) throw new Error('Data profil tidak valid. Nama wajib diisi.');
      data[field] = body[field].trim();
    }
  }
  if (creating || body.username !== undefined) {
    if (typeof body.username !== 'string' || !/^[a-z0-9_.-]{3,32}$/.test(body.username.trim().toLowerCase())) throw new Error('Username harus 3–32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.');
    data.username = body.username.trim().toLowerCase();
  }
  if (creating || body.role !== undefined) {
    if (!['ADMIN', 'KASIR'].includes(body.role)) throw new Error('Pilih peran Admin atau Kasir.');
    data.role = body.role;
  }
  if (creating || body.password) { const error = passwordError(body.password); if (error) throw new Error(error); }
  return data;
}
