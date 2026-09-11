import { describe, expect, it } from 'vitest';
import { demoRecipe } from '@/lib/demo-recipe';
import { recipeToCsv, recipeToMarkdown, recipeToText } from '@/lib/exports';
import { buildProgressiveStages } from '@/lib/progressive-flow';

describe('progressive recipe flow', () => {
  it('introduces each ingredient once and carries intermediate results forward', () => {
    const stages = buildProgressiveStages(demoRecipe, demoRecipe.ingredients);
    const introduced = stages.flatMap(stage => stage.ingredients.map(item => item.id));

    expect(stages.map(stage => stage.output)).toEqual([
      'Wet mixture',
      'Dry mixture',
      'Batter',
      'Baked loaf',
      'Banana bread',
    ]);
    expect(new Set(introduced).size).toBe(demoRecipe.ingredients.length);
    expect(introduced).toHaveLength(demoRecipe.ingredients.length);
  });

  it('includes the structured flow in text and CSV exports', () => {
    expect(recipeToMarkdown(demoRecipe)).toContain('## Progressive cooking flow');
    expect(recipeToMarkdown(demoRecipe)).toContain('Result: **Wet mixture**');
    expect(recipeToText(demoRecipe)).toContain('Progressive cooking flow');
    expect(recipeToCsv(demoRecipe)).toContain('"flow"');
    expect(recipeToCsv(demoRecipe)).toContain('"Make wet mixture"');
  });
});
