export function normalizeTable(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) return null;
  return value.trim().replace(/\s+/g, ' ');
}
export async function tableConflict(tx, tableNumber, excludeId) {
  if (tableNumber.toLowerCase().startsWith('take away')) return false;
  const key = tableNumber.toLowerCase();
  // Lock a key even when no session exists yet. Every creation/rename uses it.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'table:' + key}))`;
  const rows = await tx.transaction.findMany({ where: { status: { in: ['open','ordered'] }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { tableNumber: true } });
  return rows.some(row => normalizeTable(row.tableNumber)?.toLowerCase() === key);
}
