import { TranslateRequestSchema } from '@/lib/recipe-schema';
import { translateWithFallback } from '@/services/ai';
import { enforceRateLimit, RateLimitError } from '@/services/rate-limit';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'recipe-translate', 30, 600);
    const input = TranslateRequestSchema.parse(await request.json());
    if (input.recipe.language === input.targetLanguage) return Response.json({ recipe: input.recipe, cached: false });
    const result = await translateWithFallback(input.recipe, input.targetLanguage);
    return Response.json({ recipe: result.recipe, provider: result.provider, cached: false }, { headers: { 'cache-control': 'private, max-age=0' } });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: { code: 'RATE_LIMITED' } }, { status: 429, headers: { 'retry-after': String(Math.max(1, error.resetAt - Math.floor(Date.now() / 1000))) } });
    console.error('Recipe translation failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: { code: 'TRANSLATION_FAILED' } }, { status: 422 });
  }
}
