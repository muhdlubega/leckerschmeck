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
  const canvas = document.createElement('canvas');
  canvas.width = width;
  const measureCtx = canvas.getContext('2d');
  if (!measureCtx) return;

  const titleFont = '700 54px Georgia, serif';
  const itemFont = '24px Arial, sans-serif';
  const actionFont = '700 35px Georgia, serif';
  const detailFont = '22px Arial, sans-serif';
  const resultFont = '700 20px Arial, sans-serif';
  const labelFont = '700 18px Arial, sans-serif';
  const titleLines = wrapCanvasLines(measureCtx, recipe.title, width - 144, titleFont);
  const headerHeight = Math.max(250, 54 + titleLines.length * 64 + 88);
  const layouts = stages.map(stage => {
    const itemEntries = [
      ...stage.inputs.map(input => `Carry forward: ${input}`),
      ...stage.ingredients.map(item => ingredientLine(item, numberStyle)),
    ];
    const items = (itemEntries.length ? itemEntries : ['Use the result from the previous stage.'])
      .map(text => wrapCanvasLines(measureCtx, text, 464, itemFont));
    const meta = wrapCanvasLines(measureCtx, `ACTION ${stage.order}${stageMeta(stage) ? `  |  ${stageMeta(stage)}` : ''}`, 646, labelFont);
    const action = wrapCanvasLines(measureCtx, stage.action, 646, actionFont);
    const detail = stage.detail ? wrapCanvasLines(measureCtx, stage.detail, 646, detailFont) : [];
    const result = wrapCanvasLines(measureCtx, `RESULT: ${stage.output}`, 610, resultFont);
    const itemsHeight = items.reduce((sum, lines) => sum + lines.length * 34, 0) + Math.max(0, items.length - 1) * 14;
    const addHeight = 28 + 22 + 22 + itemsHeight + 30;
    const actionHeight = 28 + meta.length * 24 + 18 + action.length * 44 + (detail.length ? 16 + detail.length * 32 : 0) + 22 + result.length * 30 + 34;
    return { stage, items, meta, action, detail, result, rowHeight: Math.max(260, addHeight, actionHeight) };
  });
  const height = headerHeight + layouts.reduce((sum, layout) => sum + layout.rowHeight + 28, 0) + 70;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#3d704d';
  ctx.fillRect(0, 0, 24, height);
  ctx.fillStyle = '#26372b';
  ctx.font = titleFont;
  drawTextLines(ctx, titleLines, 72, 54, 64);
  ctx.fillStyle = '#65736a';
  ctx.font = '24px Arial, sans-serif';
  ctx.fillText(`${recipe.servings?.amount ?? 'N/A'} servings · Prep ${formatMinutes(recipe.times.prepMinutes)} · Cook ${formatMinutes(recipe.times.cookMinutes)}`, 76, 54 + titleLines.length * 64 + 24);

  let y = headerHeight;
  layouts.forEach(({ stage, items, meta, action, detail, result, rowHeight }, index) => {
    const addX = 76;
    const addWidth = 520;
    const actionX = 710;
    const actionWidth = 710;
    roundedRect(ctx, addX, y, addWidth, rowHeight, 22, index % 2 ? '#f2f5ea' : '#f8f0e7', '#cbd4c4');
    roundedRect(ctx, actionX, y, actionWidth, rowHeight, 22, '#3d704d', '#315c3f');

    ctx.fillStyle = '#65736a';
    ctx.font = labelFont;
    ctx.fillText(stage.ingredients.length || stage.inputs.length ? 'ADD ITEMS' : 'CONTINUE', addX + 28, y + 28);
    ctx.fillStyle = '#26372b';
    ctx.font = itemFont;
    let itemY = y + 72;
    items.forEach(lines => {
      drawTextLines(ctx, lines, addX + 28, itemY, 34);
      itemY += lines.length * 34 + 14;
    });

    ctx.fillStyle = '#3d704d';
    ctx.beginPath();
    ctx.moveTo(625, y + rowHeight / 2 - 18);
    ctx.lineTo(665, y + rowHeight / 2);
    ctx.lineTo(625, y + rowHeight / 2 + 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = labelFont;
    drawTextLines(ctx, meta, actionX + 32, y + 28, 24);
    ctx.fillStyle = '#fffdf7';
    ctx.font = actionFont;
    let actionY = y + 28 + meta.length * 24 + 18;
    drawTextLines(ctx, action, actionX + 32, actionY, 44);
    actionY += action.length * 44;
    if (detail.length) {
      actionY += 16;
      ctx.fillStyle = 'rgba(255,255,255,.84)';
      ctx.font = detailFont;
      drawTextLines(ctx, detail, actionX + 32, actionY, 32);
      actionY += detail.length * 32;
    }
    actionY += 22;
    const resultBoxHeight = result.length * 30 + 20;
    roundedRect(ctx, actionX + 24, actionY - 10, actionWidth - 48, resultBoxHeight, 12, 'rgba(255,255,255,.10)', 'rgba(255,255,255,.18)');
    ctx.fillStyle = '#f4c89b';
    ctx.font = resultFont;
    drawTextLines(ctx, result, actionX + 40, actionY, 30);
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

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string) {
  ctx.font = font;
  const words = text.trim().split(/\s+/).flatMap(word => splitLongCanvasWord(ctx, word, maxWidth));
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
  return lines.length ? lines : [''];
}

function splitLongCanvasWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number) {
  if (ctx.measureText(word).width <= maxWidth) return [word];
  const chunks: string[] = [];
  let chunk = '';
  for (const character of Array.from(word)) {
    if (chunk && ctx.measureText(chunk + character).width > maxWidth) {
      chunks.push(chunk);
      chunk = character;
    } else chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function drawTextLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
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
