import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { sharedRecipes } from '@/db/schema';
import { RecipeSchema } from '@/lib/recipe-schema';
import { enforceRateLimit, RateLimitError } from '@/services/rate-limit';

export const runtime = 'edge';
const TTL_SECONDS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'recipe-share', 20, 3600);
    const recipe = RecipeSchema.parse(await request.json());
    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const now = Math.floor(Date.now() / 1000);
    await getDb().insert(sharedRecipes).values({ id, recipeJson: JSON.stringify(recipe), createdAt: now, expiresAt: now + TTL_SECONDS });
    return Response.json({ id, path: `/r/${id}` }, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: { code: 'RATE_LIMITED' } }, { status: 429, headers: { 'retry-after': String(Math.max(1, error.resetAt - Math.floor(Date.now() / 1000))) } });
    console.error('Share creation failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: { code: 'SHARE_FAILED' } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[a-f0-9]{12}$/.test(id)) return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  const row = await getDb().select().from(sharedRecipes).where(eq(sharedRecipes.id, id)).get();
  if (!row || row.expiresAt < Date.now() / 1000) return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  return Response.json({ recipe: RecipeSchema.parse(JSON.parse(row.recipeJson)) }, { headers: { 'cache-control': 'public, max-age=300' } });
}
