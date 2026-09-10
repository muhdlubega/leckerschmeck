import type { Ingredient } from './recipe-schema';

export type MeasurementSystem = 'original' | 'metric' | 'us';
const mass: Record<string, { base: number; metric: [string, number]; us: [string, number] }> = {
  mg: { base: .001, metric: ['g', 1], us: ['oz', 28.3495] }, g: { base: 1, metric: ['g', 1], us: ['oz', 28.3495] }, kg: { base: 1000, metric: ['kg', 1000], us: ['lb', 453.592] }, oz: { base: 28.3495, metric: ['g', 1], us: ['oz', 28.3495] }, lb: { base: 453.592, metric: ['kg', 1000], us: ['lb', 453.592] },
};
const volume: Record<string, { base: number; metric: [string, number]; us: [string, number] }> = {
  ml: { base: 1, metric: ['ml', 1], us: ['fl oz', 29.5735] }, l: { base: 1000, metric: ['L', 1000], us: ['cup', 236.588] }, tsp: { base: 4.92892, metric: ['ml', 1], us: ['tsp', 4.92892] }, tbsp: { base: 14.7868, metric: ['ml', 1], us: ['tbsp', 14.7868] }, cup: { base: 236.588, metric: ['ml', 1], us: ['cup', 236.588] }, cups: { base: 236.588, metric: ['ml', 1], us: ['cup', 236.588] }, 'fl oz': { base: 29.5735, metric: ['ml', 1], us: ['fl oz', 29.5735] },
};

export function convertIngredient(item: Ingredient, system: MeasurementSystem): Ingredient {
  if (system === 'original' || item.quantity === null || !item.normalizedUnit) return item;
  const key = item.normalizedUnit.toLowerCase();
  const entry = mass[key] ?? volume[key];
  if (!entry) return item;
  const [unit, divisor] = system === 'metric' ? entry.metric : entry.us;
  return { ...item, quantity: item.quantity * entry.base / divisor, quantityMax: item.quantityMax === null ? null : item.quantityMax * entry.base / divisor, unit, normalizedUnit: unit };
}

export function convertTemperature(value: number, from: 'C' | 'F', to: 'C' | 'F'): number {
  if (from === to) return value;
  return to === 'C' ? Math.round((value - 32) * 5 / 9) : Math.round(value * 9 / 5 + 32);
}
