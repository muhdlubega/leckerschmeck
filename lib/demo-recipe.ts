import type { Recipe } from './recipe-schema';

export const demoRecipe: Recipe = {
  schemaVersion: 1, id: 'demo-banana-bread', source: { url: 'https://example.com/banana-bread', siteName: 'Sample Kitchen', author: 'LeckerSchmeck demo' },
  title: 'Sunday Banana Bread', description: 'A tender, deeply banana-scented loaf with a crisp walnut top.', image: null, language: 'en', originalLanguage: 'en', translatedFrom: null,
  servings: { amount: 10, label: '10 slices' }, times: { prepMinutes: 15, cookMinutes: 55, totalMinutes: 70 },
  ingredients: [
    { id: 'banana', rawText: '2 large ripe bananas, mashed', quantity: 2, quantityMax: null, unit: null, normalizedUnit: null, ingredient: 'large ripe bananas', preparation: 'mashed', optional: false, group: 'Wet mixture' },
    { id: 'butter', rawText: '⅓ cup unsalted butter, melted', quantity: 1/3, quantityMax: null, unit: 'cup', normalizedUnit: 'cup', ingredient: 'unsalted butter', preparation: 'melted', optional: false, group: 'Wet mixture' },
    { id: 'vanilla', rawText: '1 tsp vanilla extract', quantity: 1, quantityMax: null, unit: 'tsp', normalizedUnit: 'tsp', ingredient: 'vanilla extract', preparation: null, optional: false, group: 'Wet mixture' },
    { id: 'egg', rawText: '1 large egg, lightly beaten', quantity: 1, quantityMax: null, unit: null, normalizedUnit: null, ingredient: 'large egg', preparation: 'lightly beaten', optional: false, group: 'Wet mixture' },
    { id: 'flour', rawText: '1½ cups all-purpose flour', quantity: 1.5, quantityMax: null, unit: 'cups', normalizedUnit: 'cup', ingredient: 'all-purpose flour', preparation: null, optional: false, group: 'Dry mixture' },
    { id: 'sugar', rawText: '¾ cup brown sugar', quantity: .75, quantityMax: null, unit: 'cup', normalizedUnit: 'cup', ingredient: 'brown sugar', preparation: null, optional: false, group: 'Dry mixture' },
    { id: 'soda', rawText: '1 tsp baking soda', quantity: 1, quantityMax: null, unit: 'tsp', normalizedUnit: 'tsp', ingredient: 'baking soda', preparation: null, optional: false, group: 'Dry mixture' },
    { id: 'salt', rawText: '½ tsp fine salt', quantity: .5, quantityMax: null, unit: 'tsp', normalizedUnit: 'tsp', ingredient: 'fine salt', preparation: null, optional: false, group: 'Dry mixture' },
    { id: 'walnuts', rawText: '½ cup walnuts, chopped (optional)', quantity: .5, quantityMax: null, unit: 'cup', normalizedUnit: 'cup', ingredient: 'walnuts', preparation: 'chopped', optional: true, group: 'Finish' },
  ],
  ingredientGroups: [
    { id: 'wet', name: 'Wet mixture', ingredientIds: ['banana', 'butter', 'vanilla', 'egg'] },
    { id: 'dry', name: 'Dry mixture', ingredientIds: ['flour', 'sugar', 'soda', 'salt'] },
    { id: 'finish', name: 'Finish', ingredientIds: ['walnuts'] },
  ],
  instructions: [
    { id: 's1', order: 1, text: 'Heat the oven to 170°C / 350°F and line a loaf pan.', action: 'preheat', ingredientIds: [], temperature: { value: 170, unit: 'C' }, durationMinutes: null, equipment: ['loaf pan', 'oven'] },
    { id: 's2', order: 2, text: 'Mash the bananas with the melted butter and vanilla until smooth.', action: 'mash', ingredientIds: ['banana', 'butter', 'vanilla'], temperature: null, durationMinutes: null, equipment: ['mixing bowl'] },
    { id: 's3', order: 3, text: 'Mix in the lightly beaten egg.', action: 'mix', ingredientIds: ['egg'], temperature: null, durationMinutes: null, equipment: [] },
    { id: 's4', order: 4, text: 'Whisk the flour, brown sugar, baking soda and salt in a separate bowl.', action: 'whisk', ingredientIds: ['flour', 'sugar', 'soda', 'salt'], temperature: null, durationMinutes: null, equipment: ['mixing bowl', 'whisk'] },
    { id: 's5', order: 5, text: 'Fold the dry mixture into the banana mixture just until no flour pockets remain.', action: 'fold', ingredientIds: ['flour', 'sugar', 'soda', 'salt', 'banana', 'butter', 'vanilla', 'egg'], temperature: null, durationMinutes: null, equipment: ['spatula'] },
    { id: 's6', order: 6, text: 'Pour into the pan, scatter over the walnuts, and bake for 55 minutes.', action: 'bake', ingredientIds: ['walnuts'], temperature: { value: 170, unit: 'C' }, durationMinutes: 55, equipment: ['loaf pan', 'oven'] },
    { id: 's7', order: 7, text: 'Cool in the pan for 10 minutes.', action: 'cool', ingredientIds: [], temperature: null, durationMinutes: 10, equipment: [] },
    { id: 's8', order: 8, text: 'Transfer to a wire rack and cool before slicing.', action: 'cool', ingredientIds: [], temperature: null, durationMinutes: null, equipment: ['wire rack'] },
  ],
  flow: [
    { id: 'wet-flow', type: 'mix', label: 'Make wet mixture', detail: 'Mash bananas, butter and vanilla; mix in egg.', inputs: ['banana', 'butter', 'vanilla', 'egg'], outputs: ['wet-mixture'], ingredientIds: ['banana', 'butter', 'vanilla', 'egg'], durationMinutes: null, temperature: null },
    { id: 'dry-flow', type: 'mix', label: 'Whisk dry mixture', detail: 'Whisk until evenly combined.', inputs: ['flour', 'sugar', 'soda', 'salt'], outputs: ['dry-mixture'], ingredientIds: ['flour', 'sugar', 'soda', 'salt'], durationMinutes: null, temperature: null },
    { id: 'fold-flow', type: 'combine', label: 'Fold gently', detail: 'Stop as soon as no flour pockets remain.', inputs: ['wet-mixture', 'dry-mixture'], outputs: ['batter'], ingredientIds: [], durationMinutes: null, temperature: null },
    { id: 'bake-flow', type: 'bake', label: 'Bake', detail: 'Scatter walnuts over the top.', inputs: ['batter', 'walnuts'], outputs: ['baked-loaf'], ingredientIds: ['walnuts'], durationMinutes: 55, temperature: { value: 170, unit: 'C' } },
    { id: 'cool-flow', type: 'cool', label: 'Cool & finish', detail: 'Cool in the pan, then move to a wire rack.', inputs: ['baked-loaf'], outputs: ['banana-bread'], ingredientIds: [], durationMinutes: 10, temperature: null },
  ], equipment: ['2 mixing bowls', 'whisk', 'spatula', 'loaf pan', 'wire rack', 'oven'], notes: ['Do not overmix after adding the flour.'], nutrition: { calories: '215 kcal per slice' },
};
