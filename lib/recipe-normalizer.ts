import { parseIngredient } from './ingredient-parser';
import { RecipeSchema, type FlowNode, type Instruction, type Recipe } from './recipe-schema';

export function parseDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const hours = Number(value.match(/(\d+(?:\.\d+)?)H/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)M/i)?.[1] ?? 0);
  const plain = value.match(/(\d+)\s*(?:minutes?|mins?)/i);
  return hours * 60 + minutes || (plain ? Number(plain[1]) : null);
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text.trim();
  if (value && typeof value === 'object' && 'itemListElement' in value && Array.isArray(value.itemListElement)) return value.itemListElement.map(textOf).filter(Boolean).join(' ');
  return '';
}

function flattenInstructions(value: unknown): string[] {
  if (!Array.isArray(value)) return textOf(value) ? [textOf(value)] : [];
  return value.flatMap(item => {
    if (item && typeof item === 'object' && 'itemListElement' in item && Array.isArray(item.itemListElement)) return flattenInstructions(item.itemListElement);
    const text = textOf(item);
    return text ? [text] : [];
  });
}

function temperature(text: string) {
  const match = text.match(/(\d{2,3})\s*°?\s*(C|F)\b/i);
  return match ? { value: Number(match[1]), unit: match[2].toUpperCase() as 'C' | 'F' } : null;
}

function instructionFromText(text: string, index: number): Instruction {
  const duration = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/i);
  const action = text.match(/^\s*([A-Za-zÀ-ž-]+)/)?.[1]?.toLowerCase() ?? null;
  return { id: `step-${index + 1}`, order: index + 1, text, action, ingredientIds: [], temperature: temperature(text), durationMinutes: duration ? Number(duration[1]) : null, equipment: [] };
}

function makeFlow(instructions: Instruction[]): FlowNode[] {
  return instructions.map((step, index) => ({ id: `flow-${index + 1}`, type: flowType(step.action), label: step.action ? `${step.action[0].toUpperCase()}${step.action.slice(1)}` : `Step ${index + 1}`, detail: step.text, inputs: index ? [`flow-${index}`] : [], outputs: index < instructions.length - 1 ? [`flow-${index + 2}`] : [], ingredientIds: step.ingredientIds, durationMinutes: step.durationMinutes, temperature: step.temperature }));
}

function flowType(action: string | null): FlowNode['type'] {
  if (!action) return 'prep';
  if (['bake', 'boil', 'fry', 'blend', 'cool', 'serve', 'rest', 'assemble', 'mix'].includes(action)) return action as FlowNode['type'];
  if (['fold', 'combine', 'add', 'stir'].includes(action)) return 'combine';
  if (['cook', 'roast', 'grill', 'simmer'].includes(action)) return 'cook';
  return 'prep';
}

function firstImage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstImage(value[0]);
  if (value && typeof value === 'object' && 'url' in value && typeof value.url === 'string') return value.url;
  return null;
}

export function normalizeJsonLd(data: Record<string, unknown>, sourceUrl: string): Recipe {
  const ingredientTexts = Array.isArray(data.recipeIngredient) ? data.recipeIngredient.filter((x): x is string => typeof x === 'string') : [];
  const ingredients = ingredientTexts.map(parseIngredient);
  const instructionTexts = flattenInstructions(data.recipeInstructions);
  const instructions = instructionTexts.map(instructionFromText);
  const yieldText = Array.isArray(data.recipeYield) ? String(data.recipeYield[0]) : typeof data.recipeYield === 'string' || typeof data.recipeYield === 'number' ? String(data.recipeYield) : '';
  const amount = Number(yieldText.match(/\d+(?:\.\d+)?/)?.[0] ?? 0) || null;
  const authorValue = data.author;
  const author = typeof authorValue === 'string' ? authorValue : authorValue && typeof authorValue === 'object' && 'name' in authorValue && typeof authorValue.name === 'string' ? authorValue.name : null;
  const url = new URL(sourceUrl);
  return RecipeSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), source: { url: sourceUrl, siteName: url.hostname.replace(/^www\./, ''), author }, title: typeof data.name === 'string' ? data.name.trim() : '', description: typeof data.description === 'string' ? data.description.trim() : null, image: firstImage(data.image), language: 'en', originalLanguage: 'en', translatedFrom: null, servings: amount ? { amount, label: yieldText || null } : null, times: { prepMinutes: parseDuration(data.prepTime), cookMinutes: parseDuration(data.cookTime), totalMinutes: parseDuration(data.totalTime) }, ingredients, ingredientGroups: [], instructions, flow: makeFlow(instructions), equipment: [], notes: [], nutrition: data.nutrition && typeof data.nutrition === 'object' ? Object.fromEntries(Object.entries(data.nutrition as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) : null });
}

export function normalizeAiRecipe(value: unknown): Recipe { return RecipeSchema.parse(value); }
