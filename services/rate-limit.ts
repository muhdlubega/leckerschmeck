import { env } from 'cloudflare:workers';

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowSeconds: number) {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}:${ip}`));
  const key = Array.from(new Uint8Array(digest).slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  const now = Math.floor(Date.now() / 1000);
  const reset = now + windowSeconds;
  const row = await env.DB.prepare(`INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
      reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
    RETURNING count, reset_at`).bind(key, reset, now, now).first<{ count: number; reset_at: number }>();
  if (!row || row.count > limit) throw new RateLimitError(row?.reset_at ?? reset);
}

export class RateLimitError extends Error {
  constructor(public resetAt: number) { super('RATE_LIMITED'); }
}
