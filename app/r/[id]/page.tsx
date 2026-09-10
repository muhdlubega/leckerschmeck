import type { Metadata } from 'next';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { sharedRecipes } from '@/db/schema';
import { RecipeApp } from '@/features/recipe/recipe-app';
import { RecipeSchema } from '@/lib/recipe-schema';

async function load(id: string) {
  if (!/^[a-f0-9]{12}$/.test(id)) return null;
  const row = await getDb().select().from(sharedRecipes).where(eq(sharedRecipes.id, id)).get();
  if (!row || row.expiresAt < Date.now() / 1000) return null;
  const parsed = RecipeSchema.safeParse(JSON.parse(row.recipeJson));
  return parsed.success ? parsed.data : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const recipe = await load((await params).id);
  if (!recipe) return { title: 'Recipe not found', robots: { index: false, follow: false }, openGraph: { images: [] }, twitter: { images: [] } };
  return { title: recipe.title, description: recipe.description ?? `A clean cooking flow for ${recipe.title}.`, openGraph: { title: recipe.title, description: recipe.description ?? `A clean cooking flow for ${recipe.title}.`, images: recipe.image ? [recipe.image] : [] }, twitter: { card: recipe.image ? 'summary_large_image' : 'summary', title: recipe.title, description: recipe.description ?? `A clean cooking flow for ${recipe.title}.`, images: recipe.image ? [recipe.image] : [] } };
}

export default async function SharedRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const recipe = await load((await params).id);
  if (!recipe) return <main className="grid min-h-screen place-items-center p-8 text-center"><div><h1 className="font-heading text-4xl font-semibold">Recipe not found</h1><p className="mt-3 text-muted-foreground">This link may have expired or been typed incorrectly.</p><Link href="/" className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Open LeckerSchmeck</Link></div></main>;
  return <RecipeApp initialRecipe={recipe} shared />;
}
