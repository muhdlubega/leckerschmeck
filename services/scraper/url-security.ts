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
    const answers = await Promise.all(['A', 'AAAA'].map(type => resolveDns(hostname, type)));
    if (answers.flat().some(isPrivateIp)) throw new Error('UNSAFE_URL');
  }
  return url;
}

async function resolveDns(hostname: string, type: string) {
  const query = `name=${encodeURIComponent(hostname)}&type=${type}`;
  const resolvers = [`https://cloudflare-dns.com/dns-query?${query}`, `https://dns.google/resolve?${query}`];
  for (const resolver of resolvers) {
    try {
      const response = await fetch(resolver, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(3_000) });
      if (!response.ok) continue;
      const payload = await response.json() as { Answer?: Array<{ data?: string }> };
      return (payload.Answer ?? []).map(answer => answer.data ?? '').filter(Boolean);
    } catch { /* try the backup resolver */ }
  }
  throw new Error('DNS_VALIDATION_FAILED');
}
