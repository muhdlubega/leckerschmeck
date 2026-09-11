import type { Ingredient, Recipe } from './recipe-schema';
import { formatQuantity } from './fractions';
import { buildProgressiveStages } from './progressive-flow';

function ingredientLine(item: Ingredient, numberStyle: 'fraction' | 'decimal' = 'fraction') {
  const quantity = formatQuantity(item.quantity, numberStyle);
  const range = item.quantityMax ? ` to ${formatQuantity(item.quantityMax, numberStyle)}` : '';
  return `${quantity}${range} ${item.unit ?? ''} ${item.ingredient}${item.preparation ? `, ${item.preparation}` : ''}`.replace(/\s+/g, ' ').trim();
}

function stageMeta(stage: ReturnType<typeof buildProgressiveStages>[number]) {
  return [stage.temperature ? `${stage.temperature.value}°${stage.temperature.unit}` : '', stage.durationMinutes ? `${stage.durationMinutes} min` : ''].filter(Boolean).join(' · ');
}

export function recipeToMarkdown(recipe: Recipe) {
  const stages = buildProgressiveStages(recipe, recipe.ingredients);
  const flow = stages.map(stage => {
    const additions = stage.ingredients.length ? stage.ingredients.map(item => `  - Add ${ingredientLine(item)}`).join('\n') : '  - Continue with the previous result';
    const inputs = stage.inputs.map(input => `  - Use ${input}`).join('\n');
    return `### ${stage.order}. ${stage.action}${stageMeta(stage) ? ` (${stageMeta(stage)})` : ''}\n\n${[additions, inputs].filter(Boolean).join('\n')}\n\n${stage.detail ?? ''}\n\nResult: **${stage.output}**`;
  }).join('\n\n');

  return `# ${recipe.title}\n\n${recipe.description ?? ''}\n\n**Servings:** ${recipe.servings?.amount ?? 'N/A'}  \n**Prep:** ${recipe.times.prepMinutes ?? 'N/A'} min · **Cook:** ${recipe.times.cookMinutes ?? 'N/A'} min\n\n## Ingredients\n\n${recipe.ingredients.map(i => `- ${ingredientLine(i)}`).join('\n')}\n\n## Progressive cooking flow\n\n${flow}\n\n## Instructions\n\n${recipe.instructions.map(i => `${i.order}. ${i.text}`).join('\n')}\n\nSource: ${recipe.source.url}\n`;
}

export function recipeToText(recipe: Recipe) {
  return recipeToMarkdown(recipe).replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/^- /gm, '• ');
}

export function recipeToCsv(recipe: Recipe) {
  const ingredientRows = recipe.ingredients.map((item, index) => [
    'ingredient', index + 1, item.quantity ?? '', item.quantityMax ?? '', item.unit ?? '', item.ingredient,
    item.preparation ?? '', item.group ?? '', '', '', '', '',
  ]);
  const flowRows = buildProgressiveStages(recipe, recipe.ingredients).map(stage => [
    'flow', stage.order, '', '', '', stage.ingredients.map(item => item.ingredient).join(' + '), '', '',
    stage.action, stage.detail ?? '', stageMeta(stage), stage.output,
  ]);
  const header = ['section', 'order', 'quantity', 'quantity_max', 'unit', 'items', 'preparation', 'group', 'action', 'detail', 'time_temperature', 'result'];
  return [header, ...ingredientRows, ...flowRows].map(row => row.map(csv).join(',')).join('\n');
}

function csv(value: unknown) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadRecipeFlowPng(recipe: Recipe, ingredients: Ingredient[], numberStyle: 'fraction' | 'decimal') {
  const stages = buildProgressiveStages(recipe, ingredients);
  const width = 1500;
  const rowHeights = stages.map(stage => Math.max(250, 150 + Math.max(stage.ingredients.length + stage.inputs.length, 2) * 38));
  const height = 250 + rowHeights.reduce((sum, value) => sum + value + 28, 0);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#3d704d';
  ctx.fillRect(0, 0, 24, height);
  ctx.fillStyle = '#26372b';
  ctx.font = '700 54px Georgia, serif';
  drawWrappedText(ctx, recipe.title, 72, 82, width - 144, 64, 2);
  ctx.fillStyle = '#65736a';
  ctx.font = '24px Arial, sans-serif';
  ctx.fillText(`${recipe.servings?.amount ?? 'N/A'} servings · Prep ${formatMinutes(recipe.times.prepMinutes)} · Cook ${formatMinutes(recipe.times.cookMinutes)}`, 76, 190);

  let y = 230;
  stages.forEach((stage, index) => {
    const rowHeight = rowHeights[index];
    const addX = 76;
    const addWidth = 520;
    const actionX = 710;
    const actionWidth = 710;
    roundedRect(ctx, addX, y, addWidth, rowHeight, 22, index % 2 ? '#f2f5ea' : '#f8f0e7', '#cbd4c4');
    roundedRect(ctx, actionX, y, actionWidth, rowHeight, 22, '#3d704d', '#315c3f');

    ctx.fillStyle = '#65736a';
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillText(stage.ingredients.length || stage.inputs.length ? 'ADD' : 'CONTINUE', addX + 28, y + 42);
    ctx.fillStyle = '#26372b';
    ctx.font = '24px Arial, sans-serif';
    let itemY = y + 82;
    const lines = [...stage.inputs.map(input => `↳ ${input}`), ...stage.ingredients.map(item => ingredientLine(item, numberStyle))];
    (lines.length ? lines : ['Previous result']).forEach(line => {
      itemY = drawWrappedText(ctx, line, addX + 28, itemY, addWidth - 56, 31, 2) + 10;
    });

    ctx.fillStyle = '#3d704d';
    ctx.beginPath();
    ctx.moveTo(625, y + rowHeight / 2 - 18);
    ctx.lineTo(665, y + rowHeight / 2);
    ctx.lineTo(625, y + rowHeight / 2 + 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillText(`STEP ${stage.order}${stageMeta(stage) ? ` · ${stageMeta(stage)}` : ''}`, actionX + 32, y + 44);
    ctx.fillStyle = '#fffdf7';
    ctx.font = '700 35px Georgia, serif';
    let actionY = drawWrappedText(ctx, stage.action, actionX + 32, y + 88, actionWidth - 64, 42, 2) + 16;
    if (stage.detail) {
      ctx.fillStyle = 'rgba(255,255,255,.84)';
      ctx.font = '22px Arial, sans-serif';
      actionY = drawWrappedText(ctx, stage.detail, actionX + 32, actionY, actionWidth - 64, 30, 3) + 18;
    }
    ctx.fillStyle = '#f4c89b';
    ctx.font = '700 20px Arial, sans-serif';
    drawWrappedText(ctx, `RESULT: ${stage.output}`, actionX + 32, Math.min(actionY, y + rowHeight - 38), actionWidth - 64, 28, 2);
    y += rowHeight + 28;
  });

  ctx.fillStyle = '#3d704d';
  ctx.font = '700 20px Arial, sans-serif';
  ctx.fillText('LECKERSCHMECK · A RECIPE YOU CAN FOLLOW', 76, height - 35);
  const link = document.createElement('a');
  link.download = `${slug(recipe.title)}-flow.png`;
  link.href = canvas.toDataURL('image/png');
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatMinutes(minutes: number | null) {
  if (!minutes) return 'N/A';
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim() : `${minutes}m`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'recipe';
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[.,;:]?$/, '')}…`;
  visible.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  return y + Math.max(0, visible.length - 1) * lineHeight;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}
