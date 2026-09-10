import { describe, expect, it } from 'vitest';
import { extractPage } from '@/services/scraper';
import { normalizeJsonLd } from '@/lib/recipe-normalizer';

describe('JSON-LD extraction', () => {
  it('prefers schema.org Recipe data and normalizes it', () => {
    const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"Recipe","name":"Toast","recipeYield":"2 servings","prepTime":"PT2M","cookTime":"PT5M","recipeIngredient":["2 slices bread","1 tbsp butter"],"recipeInstructions":[{"@type":"HowToStep","text":"Toast the bread for 5 minutes."}]}</script><article>Story</article></html>`;
    const page = extractPage(html); const recipe = normalizeJsonLd(page.jsonLd!, 'https://example.com/toast');
    expect(recipe.title).toBe('Toast'); expect(recipe.ingredients).toHaveLength(2); expect(recipe.servings?.amount).toBe(2); expect(recipe.instructions[0].durationMinutes).toBe(5);
  });
});
