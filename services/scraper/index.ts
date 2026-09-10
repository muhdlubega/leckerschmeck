import * as cheerio from 'cheerio';
import { assertSafeUrl } from './url-security';

const MAX_BYTES = 2_500_000;
const MAX_REDIRECTS = 4;

export async function fetchRecipePage(input: string) {
  let current = await assertSafeUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(9_000), headers: { 'user-agent': 'LeckerSchmeck/1.0 (+recipe reader)', accept: 'text/html,application/xhtml+xml' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) throw new Error('TOO_MANY_REDIRECTS');
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`UPSTREAM_${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('UNSUPPORTED_CONTENT');
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) throw new Error('RESPONSE_TOO_LARGE');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('EMPTY_RESPONSE');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); throw new Error('RESPONSE_TOO_LARGE'); } chunks.push(value); }
    const html = new TextDecoder().decode(concat(chunks, size));
    return { html, finalUrl: current.toString() };
  }
  throw new Error('FETCH_FAILED');
}

function concat(chunks: Uint8Array[], size: number) { const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; } return output; }

export function extractPage(html: string) {
  const $ = cheerio.load(html);
  const recipes: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try { const parsed = JSON.parse($(element).text()); collectRecipes(parsed, recipes); } catch { /* malformed publisher JSON-LD is ignored */ }
  });
  $('script,style,noscript,nav,header,footer,aside,form,iframe,[class*="advert"],[class*="comment"],[class*="newsletter"],[class*="related"],[id*="advert"],[id*="comment"]').remove();
  const root = $('[itemtype*="schema.org/Recipe"], [class*="recipe-card"], [class*="recipe__"], article, main').first();
  const cleanedText = (root.length ? root : $('body')).text().replace(/\s+/g, ' ').trim().slice(0, 45_000);
  return { jsonLd: recipes[0] ?? null, cleanedText };
}

function collectRecipes(value: unknown, output: Record<string, unknown>[]) {
  if (Array.isArray(value)) { value.forEach(item => collectRecipes(item, output)); return; }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
  if (types.some(type => String(type).toLowerCase() === 'recipe')) output.push(record);
  if (Array.isArray(record['@graph'])) collectRecipes(record['@graph'], output);
}
