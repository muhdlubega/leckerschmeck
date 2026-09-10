import { languagePromptName } from './languages';

export const RECIPE_SYSTEM_PROMPT = `You extract and restructure recipes into strict JSON.
Rules:
- Use only information appearing in supplied content.
- Never invent ingredients, quantities, times, temperatures, equipment, yields, or claims.
- Return null for unavailable scalar fields and empty arrays for unavailable collections.
- Preserve preparation qualifiers and original meaning.
- Maintain ingredient-to-step relationships and separate ingredient preparation from cooking instructions.
- Build a semantic flow of actual cooking dependencies; do not merely create one node per sentence.
- Mark actual heat-based cooking nodes as cook, bake, boil, or fry. Keep mixing and assembly before the first cooking action in preparation. Put cooling, garnishing, slicing, and serving after cooking in finish.
- Remove story, advertising, SEO, navigation, and unrelated content.
- Return valid JSON matching the supplied example shape with no markdown or commentary.`;

export function extractionPrompt(content: string, sourceUrl: string, targetLanguage: string) {
  return `${RECIPE_SYSTEM_PROMPT}\n\nSource URL: ${sourceUrl}\nOutput language: ${languagePromptName(targetLanguage)}. Store the detected or selected BCP 47 language code in language and originalLanguage.\nGenerate schemaVersion 1. IDs must be short stable strings. Include source, title, description, image, language, originalLanguage, translatedFrom, servings, times, ingredients, ingredientGroups, instructions, flow, equipment, notes and nutrition. Every nullable field must be present.\n\nCONTENT:\n${content}`;
}

export function translationPrompt(recipeJson: string, targetLanguage: string) {
  return `${RECIPE_SYSTEM_PROMPT}\n\nTranslate every human-readable recipe field to ${languagePromptName(targetLanguage)}, including the title, description, ingredient names, ingredient raw text, preparation notes, ingredient group names, instruction text and actions, flow labels and details, equipment, notes, serving label, and nutrition labels. Preserve every ID, number, unit, URL, relationship and source field exactly. Set language to ${targetLanguage}, translatedFrom to the input language, and preserve originalLanguage. Return the complete recipe JSON.\n\nRECIPE:\n${recipeJson}`;
}
