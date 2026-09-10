import type { Recipe } from './recipe-schema';
import { formatQuantity } from './fractions';

export function recipeToMarkdown(recipe: Recipe) {
  return `# ${recipe.title}\n\n${recipe.description ?? ''}\n\n**Servings:** ${recipe.servings?.amount ?? 'N/A'}  \n**Prep:** ${recipe.times.prepMinutes ?? 'N/A'} min · **Cook:** ${recipe.times.cookMinutes ?? 'N/A'} min\n\n## Ingredients\n\n${recipe.ingredients.map(i => `- ${formatQuantity(i.quantity)} ${i.unit ?? ''} ${i.ingredient}${i.preparation ? `, ${i.preparation}` : ''}`).join('\n')}\n\n## Steps\n\n${recipe.instructions.map(i => `${i.order}. ${i.text}`).join('\n')}\n\nSource: ${recipe.source.url}\n`;
}
export function recipeToText(recipe: Recipe) { return recipeToMarkdown(recipe).replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/^- /gm, '• '); }
export function recipeToCsv(recipe: Recipe) { return ['quantity,unit,ingredient,preparation,optional', ...recipe.ingredients.map(i => [i.quantity ?? '', i.unit ?? '', i.ingredient, i.preparation ?? '', i.optional].map(csv).join(','))].join('\n'); }
function csv(value: unknown) { return `"${String(value).replaceAll('"', '""')}"`; }
export function downloadFile(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1_000); }
