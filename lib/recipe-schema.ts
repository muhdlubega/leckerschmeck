import { z } from 'zod';

const nullableString = z.string().trim().max(2_000).nullable();
const nullableNumber = z.number().nonnegative().nullable();

export const IngredientSchema = z.object({
  id: z.string().min(1).max(100),
  rawText: z.string().max(1_000),
  quantity: nullableNumber,
  quantityMax: nullableNumber,
  unit: z.string().max(60).nullable(),
  normalizedUnit: z.string().max(60).nullable(),
  ingredient: z.string().trim().min(1).max(400),
  preparation: z.string().max(400).nullable(),
  optional: z.boolean(),
  group: z.string().max(200).nullable(),
}).strict();

export const InstructionSchema = z.object({
  id: z.string().min(1).max(100),
  order: z.number().int().positive(),
  text: z.string().trim().min(1).max(3_000),
  action: z.string().max(100).nullable(),
  ingredientIds: z.array(z.string().max(100)).max(100),
  temperature: z.object({ value: z.number(), unit: z.enum(['C', 'F']) }).strict().nullable(),
  durationMinutes: nullableNumber,
  equipment: z.array(z.string().max(200)).max(50),
}).strict();

export const FlowNodeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['ingredient', 'ingredient-group', 'prep', 'combine', 'mix', 'rest', 'cook', 'bake', 'boil', 'fry', 'blend', 'assemble', 'cool', 'serve']),
  label: z.string().trim().min(1).max(300),
  detail: nullableString,
  inputs: z.array(z.string().max(100)).max(100),
  outputs: z.array(z.string().max(100)).max(100),
  ingredientIds: z.array(z.string().max(100)).max(100),
  durationMinutes: nullableNumber,
  temperature: z.object({ value: z.number(), unit: z.enum(['C', 'F']) }).strict().nullable(),
}).strict();

export const RecipeSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(100),
  source: z.object({ url: z.url().max(2_048), siteName: nullableString, author: nullableString }).strict(),
  title: z.string().trim().min(1).max(500),
  description: nullableString,
  image: z.url().max(2_048).nullable(),
  language: z.string().min(2).max(20),
  originalLanguage: z.string().min(2).max(20),
  translatedFrom: z.string().min(2).max(20).nullable(),
  servings: z.object({ amount: z.number().positive(), label: nullableString }).strict().nullable(),
  times: z.object({ prepMinutes: nullableNumber, cookMinutes: nullableNumber, totalMinutes: nullableNumber }).strict(),
  ingredients: z.array(IngredientSchema).min(1).max(500),
  ingredientGroups: z.array(z.object({ id: z.string().max(100), name: z.string().max(200), ingredientIds: z.array(z.string().max(100)).max(200) }).strict()).max(100),
  instructions: z.array(InstructionSchema).min(1).max(300),
  flow: z.array(FlowNodeSchema).min(1).max(500),
  equipment: z.array(z.string().max(200)).max(100),
  notes: z.array(z.string().max(2_000)).max(100),
  nutrition: z.record(z.string(), z.string().max(200)).nullable(),
}).strict();

export type Ingredient = z.infer<typeof IngredientSchema>;
export type Instruction = z.infer<typeof InstructionSchema>;
export type FlowNode = z.infer<typeof FlowNodeSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;

export const ImportRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('url'), url: z.url().max(2_048), language: z.string().min(2).max(20).default('en') }).strict(),
  z.object({ type: z.literal('text'), text: z.string().trim().min(40).max(60_000), language: z.string().min(2).max(20).default('en') }).strict(),
]);

export const TranslateRequestSchema = z.object({ recipe: RecipeSchema, targetLanguage: z.string().min(2).max(20) }).strict();

export function recipeIsComplete(value: unknown): value is Recipe {
  const result = RecipeSchema.safeParse(value);
  return result.success && result.data.ingredients.length >= 2 && result.data.instructions.length >= 1;
}
