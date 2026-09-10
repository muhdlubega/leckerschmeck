const glyphs = new Map([[1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞']]);

export function formatQuantity(value: number | null, mode: 'fraction' | 'decimal' = 'fraction'): string {
  if (value === null) return '';
  if (mode === 'decimal') return Number(value.toFixed(2)).toString();
  const whole = Math.floor(value + 1e-9);
  const remainder = value - whole;
  let best = { distance: Number.POSITIVE_INFINITY, text: '' };
  for (const [fraction, glyph] of glyphs) {
    const distance = Math.abs(remainder - fraction);
    if (distance < best.distance) best = { distance, text: glyph };
  }
  if (remainder < 0.04) return String(whole);
  if (1 - remainder < 0.04) return String(whole + 1);
  if (best.distance <= 0.035) return `${whole || ''}${best.text}`;
  return Number(value.toFixed(value < 10 ? 2 : 1)).toString();
}

export function scaleQuantity(original: number | null, originalServings: number, servings: number): number | null {
  if (original === null) return null;
  return (Math.round(original * 100_000) * Math.round((servings / originalServings) * 100_000)) / 10_000_000_000;
}

const fractionValues: Record<string, number> = { '⅛': 1/8, '¼': 1/4, '⅓': 1/3, '⅜': 3/8, '½': 1/2, '⅔': 2/3, '¾': 3/4, '⅞': 7/8 };
export function parseQuantity(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  const glyph = Object.entries(fractionValues).find(([key]) => value.includes(key));
  const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const simple = value.match(/^(\d+)\/(\d+)/);
  if (simple) return Number(simple[1]) / Number(simple[2]);
  if (glyph) return (Number(value.replace(glyph[0], '')) || 0) + glyph[1];
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
