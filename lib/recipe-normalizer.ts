import { parseIngredient } from './ingredient-parser';
import { containsCookingKeyword, containsFinishingKeyword } from './flow-phases';
import { RecipeSchema, type FlowNode, type Instruction, type Recipe } from './recipe-schema';

export function parseDuration(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== 'string') return null;
  const iso = value.trim().match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (iso) {
    const total = Number(iso[1] ?? 0) * 1_440 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0) + Number(iso[4] ?? 0) / 60;
    return total ? Math.max(1, Math.round(total)) : null;
  }
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/i)?.[1] ?? 0);
  const seconds = Number(value.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec)\b/i)?.[1] ?? 0);
  const total = hours * 60 + minutes + seconds / 60;
  return total ? Math.max(1, Math.round(total)) : null;
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return cleanText(value);
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && 'text' in value) return textOf(value.text);
  if (value && typeof value === 'object' && 'name' in value) return textOf(value.name);
  if (value && typeof value === 'object' && 'itemListElement' in value && Array.isArray(value.itemListElement)) return value.itemListElement.map(textOf).filter(Boolean).join(' ');
  return '';
}

function flattenInstructions(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(flattenInstructions);
  if (value && typeof value === 'object' && 'itemListElement' in value && Array.isArray(value.itemListElement)) return flattenInstructions(value.itemListElement);
  const text = textOf(value);
  return text ? [text] : [];
}

function temperature(text: string) {
  const match = text.match(/(\d{2,3})\s*°?\s*(C|F)\b/i);
  return match ? { value: Number(match[1]), unit: match[2].toUpperCase() as 'C' | 'F' } : null;
}

function instructionFromText(text: string, index: number, ingredientIds: string[]): Instruction {
  const action = text.match(/^\s*([\p{L}\p{M}-]+)/u)?.[1]?.toLocaleLowerCase() ?? null;
  return { id: `step-${index + 1}`, order: index + 1, text, action, ingredientIds, temperature: temperature(text), durationMinutes: parseDuration(text), equipment: [] };
}

function makeFlow(instructions: Instruction[]): FlowNode[] {
  return instructions.map((step, index) => ({ id: `flow-${index + 1}`, type: flowType(step.action, step.text), label: step.action ? `${step.action[0].toUpperCase()}${step.action.slice(1)}` : `Step ${index + 1}`, detail: step.text, inputs: index ? [`flow-${index}`] : [], outputs: index < instructions.length - 1 ? [`flow-${index + 2}`] : [], ingredientIds: step.ingredientIds, durationMinutes: step.durationMinutes, temperature: step.temperature }));
}

function flowType(action: string | null, text: string): FlowNode['type'] {
  if (!action) return containsCookingKeyword(text) ? 'cook' : containsFinishingKeyword(text) ? 'cool' : 'prep';
  if (['bake', 'boil', 'fry', 'blend', 'cool', 'serve', 'rest', 'assemble', 'mix'].includes(action)) return action as FlowNode['type'];
  if (['fold', 'combine', 'add', 'stir'].includes(action)) return 'combine';
  if (['cook', 'roast', 'grill', 'simmer'].includes(action)) return 'cook';
  if (containsCookingKeyword(`${action} ${text}`)) return 'cook';
  if (containsFinishingKeyword(`${action} ${text}`)) return 'cool';
  return 'prep';
}

function firstImage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstImage(value[0]);
  if (value && typeof value === 'object') {
    if ('url' in value) return firstImage(value.url);
    if ('contentUrl' in value) return firstImage(value.contentUrl);
  }
  return null;
}

function safeImage(value: unknown, sourceUrl: string) {
  const image = firstImage(value);
  if (!image) return null;
  try {
    const url = new URL(image, sourceUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function authorName(value: unknown) {
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(', ') || null;
  return textOf(value) || null;
}

function listOfText(value: unknown) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map(textOf).filter(Boolean))];
}

function ingredientIdsInText(text: string, ingredients: ReturnType<typeof parseIngredient>[]) {
  const haystack = searchable(text);
  const haystackWords = new Set(haystack.split(' '));
  return ingredients.filter(item => {
    const words = searchable(item.ingredient).split(' ').filter(word => word.length >= 3 || hasNonAscii(word));
    return words.some(word => hasNonAscii(word) ? haystack.includes(word) : haystackWords.has(word));
  }).map(item => item.id);
}

function hasNonAscii(value: string) {
  return Array.from(value).some(character => (character.codePointAt(0) ?? 0) > 127);
}

function searchable(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function cleanText(value: string) {
  return value.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeJsonLd(data: Record<string, unknown>, sourceUrl: string, fallbackLanguage = 'en'): Recipe {
  const ingredientTexts = Array.isArray(data.recipeIngredient) ? data.recipeIngredient.filter((x): x is string => typeof x === 'string') : [];
  const ingredients = ingredientTexts.map(parseIngredient);
  const instructionTexts = flattenInstructions(data.recipeInstructions);
  const instructions = instructionTexts.map((text, index) => instructionFromText(text, index, ingredientIdsInText(text, ingredients)));
  const yieldText = Array.isArray(data.recipeYield) ? textOf(data.recipeYield[0]) : textOf(data.recipeYield);
  const amount = Number(yieldText.match(/\d+(?:\.\d+)?/)?.[0] ?? 0) || null;
  const url = new URL(sourceUrl);
  const sourceLanguage = (textOf(data.inLanguage) || fallbackLanguage).slice(0, 20);
  const nutrition = data.nutrition && typeof data.nutrition === 'object'
    ? Object.fromEntries(Object.entries(data.nutrition as Record<string, unknown>).filter(([, value]) => ['string', 'number'].includes(typeof value)).map(([key, value]) => [key, String(value)]))
    : null;
  const equipment = [...listOfText(data.tool), ...listOfText(data.recipeEquipment)].slice(0, 100);
  return RecipeSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), source: { url: sourceUrl, siteName: url.hostname.replace(/^www\./, ''), author: authorName(data.author) }, title: textOf(data.name), description: textOf(data.description) || null, image: safeImage(data.image, sourceUrl), language: sourceLanguage, originalLanguage: sourceLanguage, translatedFrom: null, servings: amount ? { amount, label: yieldText || null } : null, times: { prepMinutes: parseDuration(data.prepTime), cookMinutes: parseDuration(data.cookTime), totalMinutes: parseDuration(data.totalTime) }, ingredients, ingredientGroups: [], instructions, flow: makeFlow(instructions), equipment, notes: listOfText(data.notes).slice(0, 100), nutrition });
}

export function normalizeAiRecipe(value: unknown): Recipe { return RecipeSchema.parse(value); }
