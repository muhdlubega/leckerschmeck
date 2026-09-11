import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { assertSafeUrl } from './url-security';

const MAX_BYTES = 4_000_000;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_CLEANED_TEXT = 55_000;
const RECIPE_ROOTS = [
  '[itemtype*="schema.org/Recipe"]',
  '[itemtype*="schema.org%2FRecipe"]',
  '.wprm-recipe-container',
  '.tasty-recipes',
  '.mv-create-card',
  '.easyrecipe',
  '.wpurp-container',
  '.recipe-card',
  '[class*="recipe-card"]',
].join(',');

export type ExtractedPage = {
  jsonLd: Record<string, unknown> | null;
  recipeCandidates: Record<string, unknown>[];
  cleanedText: string;
  language: string | null;
};

export async function fetchRecipePage(input: string) {
  let current = await assertSafeUrl(input);
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; LeckerSchmeck/1.0; +https://leckerschmeck.pages.dev)',
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'accept-language': 'en-US,en;q=0.8,*;q=0.5',
        },
      });
    } catch (error) {
      if (signal.aborted) throw new Error('FETCH_TIMEOUT');
      throw new Error(`FETCH_FAILED:${error instanceof Error ? error.name : 'unknown'}`);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) throw new Error('TOO_MANY_REDIRECTS');
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`UPSTREAM_${response.status}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!/^text\/html\b|^application\/xhtml\+xml\b/i.test(contentType)) {
      await response.body?.cancel();
      throw new Error('UNSUPPORTED_CONTENT');
    }
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) {
      await response.body?.cancel();
      throw new Error('RESPONSE_TOO_LARGE');
    }
    const html = await readBoundedHtml(response, contentType);
    return { html, finalUrl: current.toString() };
  }
  throw new Error('FETCH_FAILED');
}

async function readBoundedHtml(response: Response, contentType: string) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('EMPTY_RESPONSE');
  const decoder = createDecoder(contentType);
  const parts: string[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error('RESPONSE_TOO_LARGE');
    }
    parts.push(decoder.decode(value, { stream: true }));
  }
  parts.push(decoder.decode());
  return parts.join('');
}

function createDecoder(contentType: string) {
  const charset = contentType.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1] ?? 'utf-8';
  try { return new TextDecoder(charset); } catch { return new TextDecoder('utf-8'); }
}

export function extractPage(html: string): ExtractedPage {
  const $ = cheerio.load(html);
  const language = $('html').attr('lang')?.trim().slice(0, 20) || null;
  const metadata = pageMetadata($);
  const recipes: Record<string, unknown>[] = [];

  $('script[type^="application/ld+json"]').each((_, element) => {
    const source = $(element).text().trim().replace(/^<!--|-->$/g, '').replace(/;\s*$/, '');
    try { collectRecipes(JSON.parse(source), recipes); } catch { /* malformed publisher JSON-LD is ignored */ }
  });

  $(RECIPE_ROOTS).slice(0, 20).each((_, element) => {
    const candidate = recipeFromMarkup($, $(element), metadata, language);
    if (candidate) recipes.push(candidate);
  });

  const unique = dedupeCandidates(recipes)
    .map(candidate => enrichCandidate(candidate, metadata, language))
    .sort((left, right) => scoreCandidate(right) - scoreCandidate(left));

  $('script,style,noscript,nav,header,footer,aside,form,iframe,svg,[hidden],[aria-hidden="true"],[class*="advert"],[class*="comment"],[class*="newsletter"],[class*="related"],[class*="social"],[id*="advert"],[id*="comment"]').remove();
  const root = selectBestContentRoot($);
  const cleanedText = structuredText($, root, metadata);
  return { jsonLd: unique[0] ?? null, recipeCandidates: unique, cleanedText, language };
}

function pageMetadata($: CheerioAPI) {
  const title = firstNonEmpty(
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="twitter:title"]').attr('content'),
    $('h1').first().text(),
    $('title').text(),
  );
  const description = firstNonEmpty(
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="description"]').attr('content'),
  );
  const image = firstNonEmpty(
    $('meta[property="og:image:secure_url"]').attr('content'),
    $('meta[property="og:image"]').attr('content'),
    $('meta[name="twitter:image"]').attr('content'),
  );
  return { title, description, image };
}

function recipeFromMarkup(
  $: CheerioAPI,
  root: Cheerio<AnyNode>,
  metadata: ReturnType<typeof pageMetadata>,
  language: string | null,
): Record<string, unknown> | null {
  const ingredients = valuesFrom(root, $, [
    '[itemprop="recipeIngredient"]',
    '.wprm-recipe-ingredient',
    '.tasty-recipes-ingredients li',
    '.mv-create-ingredients li',
    '.wpurp-recipe-ingredient',
    '.easyrecipe .ERSIngredients li',
  ]);
  const instructions = valuesFrom(root, $, [
    '[itemprop="recipeInstructions"] [itemprop="text"]',
    '.wprm-recipe-instruction-text',
    '.tasty-recipes-instructions li',
    '.mv-create-instructions li',
    '.wpurp-recipe-instruction',
    '.easyrecipe .ERSInstructions li',
  ]);
  if (!instructions.length) {
    root.find('[itemprop="recipeInstructions"]').each((_, element) => {
      const container = $(element);
      const children = valuesFrom(container, $, ['li', 'p']);
      if (children.length) instructions.push(...children);
      else pushUnique(instructions, cleanText(attributeOrText(container)));
    });
  }
  if (ingredients.length < 1 || instructions.length < 1) return null;

  const title = valueFrom(root, $, ['[itemprop="name"]', '.wprm-recipe-name', '.tasty-recipes-title', '.mv-create-title', 'h1', 'h2']) || metadata.title;
  const description = valueFrom(root, $, ['[itemprop="description"]', '.wprm-recipe-summary', '.tasty-recipes-description']) || metadata.description;
  const imageElement = root.find('[itemprop="image"], .wprm-recipe-image img, .tasty-recipes-image img, img').first();
  const image = attributeOrText(imageElement) || attributeOrText(imageElement.find('img').first()) || metadata.image;
  const author = valueFrom(root, $, ['[itemprop="author"] [itemprop="name"]', '[itemprop="author"]', '.wprm-recipe-author']);
  const recipeYield = valueFrom(root, $, ['[itemprop="recipeYield"]', '.wprm-recipe-servings', '.tasty-recipes-yield']);
  const prepTime = valueFrom(root, $, ['[itemprop="prepTime"]', '.wprm-recipe-prep_time', '.tasty-recipes-prep-time']);
  const cookTime = valueFrom(root, $, ['[itemprop="cookTime"]', '.wprm-recipe-cook_time', '.tasty-recipes-cook-time']);
  const totalTime = valueFrom(root, $, ['[itemprop="totalTime"]', '.wprm-recipe-total_time', '.tasty-recipes-total-time']);
  return {
    '@type': 'Recipe', name: title, description, image, author, recipeYield, prepTime, cookTime, totalTime,
    recipeIngredient: ingredients, recipeInstructions: instructions, inLanguage: language,
  };
}

function valuesFrom(root: Cheerio<AnyNode>, $: CheerioAPI, selectors: string[]) {
  const values: string[] = [];
  for (const selector of selectors) {
    root.find(selector).each((_, element) => pushUnique(values, cleanText(attributeOrText($(element)))));
    if (values.length) break;
  }
  return values;
}

function valueFrom(root: Cheerio<AnyNode>, $: CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const element = root.find(selector).first();
    const value = cleanText(attributeOrText(element));
    if (value) return value;
  }
  return '';
}

function attributeOrText(element: Cheerio<AnyNode>) {
  return element.attr('content') ?? element.attr('datetime') ?? element.attr('src') ?? element.attr('href') ?? element.text();
}

function selectBestContentRoot($: CheerioAPI) {
  const roots = $(RECIPE_ROOTS).toArray();
  if (roots.length) {
    roots.sort((left, right) => $(right).text().length - $(left).text().length);
    return $(roots[0]);
  }
  return $('main').first().length ? $('main').first() : $('article').first().length ? $('article').first() : $('body');
}

function structuredText($: CheerioAPI, root: Cheerio<AnyNode>, metadata: ReturnType<typeof pageMetadata>) {
  const lines: string[] = [];
  pushUnique(lines, cleanText(metadata.title));
  pushUnique(lines, cleanText(metadata.description));
  root.find('h1,h2,h3,h4,p,li,dt,dd').each((_, element) => {
    const value = cleanText($(element).text());
    if (value.length >= 2 && value.length <= 3_000) pushUnique(lines, value);
  });
  if (lines.length < 3) pushUnique(lines, cleanText(root.text()));
  let output = '';
  for (const line of lines) {
    if (output.length + line.length + 1 > MAX_CLEANED_TEXT) break;
    output += `${line}\n`;
  }
  return output.trim();
}

function collectRecipes(value: unknown, output: Record<string, unknown>[], depth = 0) {
  if (depth > 20 || output.length >= 20) return;
  if (Array.isArray(value)) {
    value.forEach(item => collectRecipes(item, output, depth + 1));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
  if (types.some(type => String(type).toLowerCase().split(/[/#]/).pop() === 'recipe')) output.push(record);
  for (const key of ['@graph', 'mainEntity', 'subjectOf', 'hasPart', 'itemListElement']) {
    if (key in record) collectRecipes(record[key], output, depth + 1);
  }
}

function enrichCandidate(candidate: Record<string, unknown>, metadata: ReturnType<typeof pageMetadata>, language: string | null) {
  return {
    ...candidate,
    name: candidate.name || metadata.title,
    description: candidate.description || metadata.description || null,
    image: candidate.image || metadata.image || null,
    inLanguage: candidate.inLanguage || language || null,
  };
}

function scoreCandidate(candidate: Record<string, unknown>) {
  const ingredients = Array.isArray(candidate.recipeIngredient) ? candidate.recipeIngredient.length : 0;
  const instructions = countInstructions(candidate.recipeInstructions);
  return ingredients * 5 + instructions * 4 + (candidate.name ? 12 : 0) + (candidate.image ? 3 : 0)
    + (candidate.totalTime || candidate.cookTime ? 2 : 0) + (candidate.recipeYield ? 2 : 0);
}

function countInstructions(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countInstructions(item), 0);
  if (!value || typeof value !== 'object') return typeof value === 'string' && value.trim() ? 1 : 0;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.itemListElement)) return countInstructions(record.itemListElement);
  return typeof record.text === 'string' && record.text.trim() ? 1 : 0;
}

function dedupeCandidates(candidates: Record<string, unknown>[]) {
  const seen = new Set<string>();
  return candidates.filter(candidate => {
    const name = typeof candidate.name === 'string' ? candidate.name : '';
    const key = `${cleanText(name).toLowerCase()}|${Array.isArray(candidate.recipeIngredient) ? candidate.recipeIngredient.length : 0}|${countInstructions(candidate.recipeInstructions)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.map(value => cleanText(value ?? '')).find(Boolean) ?? '';
}

function cleanText(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function pushUnique(values: string[], value: string) {
  if (value && !values.includes(value)) values.push(value);
}
