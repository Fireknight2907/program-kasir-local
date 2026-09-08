// getRandomValues also works on LAN HTTP where randomUUID may be unavailable.
export function newOrderRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
