const forbiddenHosts = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal', 'metadata', 'host.docker.internal', 'kubernetes.default.svc']);

export function isPrivateIp(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (value === '::1' || value === '::' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return true;
  if (value.startsWith('::ffff:')) return isPrivateIp(value.slice(7));
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

export async function assertSafeUrl(input: string): Promise<URL> {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) throw new Error('INVALID_URL');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (forbiddenHosts.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost') || isPrivateIp(hostname)) throw new Error('UNSAFE_URL');
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) && !hostname.includes(':')) {
    for (const type of ['A', 'AAAA']) {
      const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(3_000) });
      if (!response.ok) throw new Error('DNS_VALIDATION_FAILED');
      const payload = await response.json() as { Answer?: Array<{ data: string }> };
      if ((payload.Answer ?? []).some(answer => isPrivateIp(answer.data))) throw new Error('UNSAFE_URL');
    }
  }
  return url;
}
