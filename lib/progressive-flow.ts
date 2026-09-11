import type { Ingredient, Recipe } from './recipe-schema';

export type ProgressiveStage = {
  id: string;
  order: number;
  ingredients: Ingredient[];
  inputs: string[];
  action: string;
  detail: string | null;
  output: string;
  durationMinutes: number | null;
  temperature: { value: number; unit: 'C' | 'F' } | null;
};

function humanize(value: string): string {
  return value
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, character => character.toUpperCase());
}

export function buildProgressiveStages(recipe: Recipe, ingredients: Ingredient[]): ProgressiveStage[] {
  const byId = new Map(ingredients.map(ingredient => [ingredient.id, ingredient]));
  const referenced = new Set(
    recipe.flow.flatMap(node => [...node.ingredientIds, ...node.inputs]).filter(id => byId.has(id)),
  );
  const unassigned = ingredients.filter(ingredient => !referenced.has(ingredient.id));
  const introduced = new Set<string>();

  return recipe.flow.map((node, index) => {
    const ingredientIds = [...new Set([...node.ingredientIds, ...node.inputs.filter(input => byId.has(input))])];
    const additions = ingredientIds
      .filter(id => !introduced.has(id))
      .map(id => byId.get(id))
      .filter((ingredient): ingredient is Ingredient => Boolean(ingredient));
    additions.forEach(ingredient => introduced.add(ingredient.id));
    if (index === 0) {
      unassigned.forEach(ingredient => {
        if (!introduced.has(ingredient.id)) additions.push(ingredient);
        introduced.add(ingredient.id);
      });
    }

    const inputs = node.inputs.filter(input => !byId.has(input)).map(humanize);
    const output = node.outputs[0]
      ? humanize(node.outputs[0])
      : index === recipe.flow.length - 1
        ? 'Ready to serve'
        : 'Ready for next step';

    return {
      id: node.id,
      order: index + 1,
      ingredients: additions,
      inputs,
      action: node.label,
      detail: node.detail,
      output,
      durationMinutes: node.durationMinutes,
      temperature: node.temperature,
    };
  });
}
