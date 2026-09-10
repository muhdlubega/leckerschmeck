import { describe, expect, it } from 'vitest';
import { assertSafeUrl, isPrivateIp } from '@/services/scraper/url-security';

describe('URL security', () => {
  it('detects private and metadata address ranges', () => { for (const ip of ['127.0.0.1', '10.0.0.5', '172.20.1.2', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1']) expect(isPrivateIp(ip)).toBe(true); expect(isPrivateIp('8.8.8.8')).toBe(false); });
  it('rejects unsafe protocols and hosts before fetching', async () => { await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow('INVALID_URL'); await expect(assertSafeUrl('http://localhost/recipe')).rejects.toThrow('UNSAFE_URL'); await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow('UNSAFE_URL'); });
});
