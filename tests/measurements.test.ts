import { describe, expect, it } from 'vitest';
import { convertIngredient, convertTemperature } from '@/lib/measurements';
import { demoRecipe } from '@/lib/demo-recipe';

describe('measurements', () => {
  it('converts temperature deterministically', () => { expect(convertTemperature(170, 'C', 'F')).toBe(338); expect(convertTemperature(350, 'F', 'C')).toBe(177); });
  it('converts compatible dimensions only', () => { const butter = demoRecipe.ingredients.find(item => item.id === 'butter')!; expect(convertIngredient(butter, 'metric').unit).toBe('ml'); const banana = demoRecipe.ingredients[0]; expect(convertIngredient(banana, 'metric')).toEqual(banana); });
});
