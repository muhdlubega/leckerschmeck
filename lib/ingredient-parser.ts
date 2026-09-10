import { parseQuantity } from './fractions';
import type { Ingredient } from './recipe-schema';

const units = ['tablespoons?', 'teaspoons?', 'tbsp', 'tsp', 'cups?', 'fluid ounces?', 'fl oz', 'ounces?', 'oz', 'pounds?', 'lb', 'milligrams?', 'mg', 'kilograms?', 'kg', 'grams?', 'g', 'milliliters?', 'ml', 'liters?', 'litres?', 'l'];
const quantityPattern = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[⅛¼⅓⅜½⅔¾⅞])`;

export function parseIngredient(rawText: string, index: number): Ingredient {
  const clean = rawText.replace(/\s+/g, ' ').trim();
  const match = clean.match(new RegExp(`^(${quantityPattern})(?:\\s*(?:-|to)\\s*(${quantityPattern}))?\\s*(?:(${units.join('|')})\\b)?\\s*(.*)$`, 'i'));
  const remaining = match?.[4]?.trim() || clean;
  const comma = remaining.indexOf(',');
  const ingredient = (comma >= 0 ? remaining.slice(0, comma) : remaining).trim();
  const preparation = comma >= 0 ? remaining.slice(comma + 1).trim() || null : null;
  const unit = match?.[3] ?? null;
  return {
    id: `ingredient-${index + 1}`,
    rawText: clean,
    quantity: match ? parseQuantity(match[1]) : null,
    quantityMax: match?.[2] ? parseQuantity(match[2]) : null,
    unit,
    normalizedUnit: normalizeUnit(unit),
    ingredient: ingredient || clean,
    preparation,
    optional: /\boptional|to taste\b/i.test(clean),
    group: null,
  };
}

function normalizeUnit(unit: string | null) {
  if (!unit) return null;
  const value = unit.toLowerCase();
  if (/^tablespoon|tbsp/.test(value)) return 'tbsp';
  if (/^teaspoon|tsp/.test(value)) return 'tsp';
  if (value.startsWith('cup')) return 'cup';
  if (/^fluid ounce|fl oz/.test(value)) return 'fl oz';
  if (/^ounce|oz/.test(value)) return 'oz';
  if (/^pound|lb/.test(value)) return 'lb';
  if (/^milligram|mg/.test(value)) return 'mg';
  if (/^kilogram|kg/.test(value)) return 'kg';
  if (/^gram|g/.test(value)) return 'g';
  if (/^milliliter|ml/.test(value)) return 'ml';
  if (/^liter|litre|l$/.test(value)) return 'l';
  return value;
}
