import { describe, expect, it } from 'vitest';
import { extractPage } from '@/services/scraper';
import { normalizeJsonLd, parseDuration } from '@/lib/recipe-normalizer';

describe('JSON-LD extraction', () => {
  it('prefers schema.org Recipe data and normalizes it', () => {
    const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"Recipe","name":"Toast","recipeYield":"2 servings","prepTime":"PT2M","cookTime":"PT5M","recipeIngredient":["2 slices bread","1 tbsp butter"],"recipeInstructions":[{"@type":"HowToStep","text":"Toast the bread for 5 minutes."}]}</script><article>Story</article></html>`;
    const page = extractPage(html); const recipe = normalizeJsonLd(page.jsonLd!, 'https://example.com/toast');
    expect(recipe.title).toBe('Toast'); expect(recipe.ingredients).toHaveLength(2); expect(recipe.servings?.amount).toBe(2); expect(recipe.instructions[0].durationMinutes).toBe(5);
  });

  it('preserves the page language and recognizes localized cooking actions', () => {
    const html = `<html lang="ms"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Recipe","name":"Roti","recipeIngredient":["2 cawan tepung","1 cawan air"],"recipeInstructions":[{"@type":"HowToStep","text":"Bakar selama 20 minit."}]}</script></html>`;
    const page = extractPage(html);
    const recipe = normalizeJsonLd(page.jsonLd!, 'https://example.com/roti', page.language ?? 'en');
    expect(recipe.language).toBe('ms');
    expect(recipe.flow[0].type).toBe('cook');
  });

  it('chooses the most complete Recipe from nested and namespaced JSON-LD', () => {
    const html = `<script type="application/ld+json; charset=utf-8"><!--{"@graph":[{"@type":"https://schema.org/Recipe","name":"Stub","recipeIngredient":["water"],"recipeInstructions":["Mix."]},{"@type":["Thing","Recipe"],"name":"Complete Soup","recipeYield":["4 bowls"],"recipeIngredient":["2 cups stock","1 cup lentils","1 carrot"],"recipeInstructions":{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Simmer the stock and lentils for 30 minutes."},{"@type":"HowToStep","text":"Serve hot."}]}}]}--></script>`;
    const page = extractPage(html);
    expect(page.recipeCandidates).toHaveLength(2);
    expect(page.jsonLd?.name).toBe('Complete Soup');
    const recipe = normalizeJsonLd(page.jsonLd!, 'https://example.com/soup');
    expect(recipe.ingredients).toHaveLength(3);
    expect(recipe.instructions).toHaveLength(2);
    expect(recipe.instructions[0].ingredientIds).toContain('ingredient-2');
  });

  it('extracts recipe plugin and microdata markup without requiring AI', () => {
    const html = `<html lang="en"><head><meta property="og:image" content="/cake.jpg"></head><body><div class="wprm-recipe-container"><h2 class="wprm-recipe-name">Simple Cake</h2><span class="wprm-recipe-servings">8 slices</span><span class="wprm-recipe-prep_time">15 minutes</span><ul><li class="wprm-recipe-ingredient">2 cups flour</li><li class="wprm-recipe-ingredient">1 cup sugar</li></ul><ol><li><span class="wprm-recipe-instruction-text">Whisk the flour and sugar.</span></li><li><span class="wprm-recipe-instruction-text">Bake for 35 minutes at 180°C.</span></li></ol></div></body></html>`;
    const page = extractPage(html);
    const recipe = normalizeJsonLd(page.jsonLd!, 'https://recipes.example/simple-cake');
    expect(recipe.title).toBe('Simple Cake');
    expect(recipe.image).toBe('https://recipes.example/cake.jpg');
    expect(recipe.servings?.amount).toBe(8);
    expect(recipe.times.prepMinutes).toBe(15);
    expect(recipe.instructions[1].temperature).toEqual({ value: 180, unit: 'C' });
  });

  it('extracts a plain schema.org microdata recipe', () => {
    const html = `<div itemscope itemtype="https://schema.org/Recipe"><meta itemprop="name" content="Rice Bowl"><meta itemprop="recipeYield" content="2 servings"><meta itemprop="prepTime" content="PT10M"><ul><li itemprop="recipeIngredient">2 cups cooked rice</li><li itemprop="recipeIngredient">1 tbsp soy sauce</li></ul><ol itemprop="recipeInstructions"><li itemprop="text">Warm the rice.</li><li itemprop="text">Stir in the soy sauce and serve.</li></ol></div>`;
    const page = extractPage(html);
    const recipe = normalizeJsonLd(page.jsonLd!, 'https://example.com/rice-bowl');
    expect(recipe.title).toBe('Rice Bowl');
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.instructions.map(step => step.text)).toEqual(['Warm the rice.', 'Stir in the soy sauce and serve.']);
  });

  it('parses ISO and human-readable durations', () => {
    expect(parseDuration('PT1H30M')).toBe(90);
    expect(parseDuration('1 hr 20 mins')).toBe(80);
    expect(parseDuration('PT45S')).toBe(1);
  });
});
