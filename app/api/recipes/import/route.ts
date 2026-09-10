import { ImportRequestSchema } from '@/lib/recipe-schema';
import { normalizeJsonLd } from '@/lib/recipe-normalizer';
import { extractWithFallback, translateWithFallback } from '@/services/ai';
import { extractPage, fetchRecipePage } from '@/services/scraper';
import { enforceRateLimit, RateLimitError } from '@/services/rate-limit';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'recipe-import', 20, 600);
    const input = ImportRequestSchema.parse(await request.json());
    if (input.type === 'text') {
      const result = await extractWithFallback(input.text, 'https://manual.local/recipe', input.language);
      return Response.json({ recipe: result.recipe, extraction: result.provider }, { headers: noStore() });
    }
    const { html, finalUrl } = await fetchRecipePage(input.url);
    const page = extractPage(html);
    if (page.jsonLd) {
      try {
        const recipe = normalizeJsonLd(page.jsonLd, finalUrl, page.language ?? 'en');
        if (recipe.ingredients.length >= 2 && recipe.instructions.length >= 1) {
          if (input.language !== 'auto' && !recipe.language.toLowerCase().startsWith(input.language)) {
            const translated = await translateWithFallback(recipe, input.language);
            return Response.json({ recipe: translated.recipe, extraction: `json-ld+${translated.provider}` }, { headers: noStore() });
          }
          return Response.json({ recipe, extraction: 'json-ld' }, { headers: noStore() });
        }
      } catch (error) { console.warn('JSON-LD incomplete', error instanceof Error ? error.message : 'unknown'); }
    }
    if (page.cleanedText.length < 80) return failure('NO_RECIPE', 422);
    const result = await extractWithFallback(page.cleanedText, finalUrl, input.language);
    return Response.json({ recipe: result.recipe, extraction: result.provider }, { headers: noStore() });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: { code: 'RATE_LIMITED' } }, { status: 429, headers: { 'retry-after': String(Math.max(1, error.resetAt - Math.floor(Date.now() / 1000))) } });
    const message = error instanceof Error ? error.message : '';
    console.error('Recipe import failed', message);
    if (/INVALID_URL|UNSAFE_URL/.test(message)) return failure('INVALID_URL', 400);
    if (/UPSTREAM_|TIMEOUT|FETCH|DNS|RESPONSE|CONTENT/.test(message)) return failure('INACCESSIBLE', 422);
    return failure('EXTRACTION_FAILED', 422);
  }
}

function failure(code: string, status: number) { return Response.json({ error: { code } }, { status, headers: noStore() }); }
function noStore() { return { 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'" }; }
