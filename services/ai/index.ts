import { RecipeSchema, type Recipe } from '@/lib/recipe-schema';
import { extractionPrompt, translationPrompt } from '@/lib/prompts';

type Provider = 'mistral' | 'gemini';

export async function extractWithFallback(content: string, sourceUrl: string, targetLanguage: string): Promise<{ recipe: Recipe; provider: Provider }> {
  const prompt = extractionPrompt(content, sourceUrl, targetLanguage);
  return runFallback(prompt);
}

export async function translateWithFallback(recipe: Recipe, targetLanguage: string): Promise<{ recipe: Recipe; provider: Provider }> {
  const result = await runFallback(translationPrompt(JSON.stringify(recipe), targetLanguage));
  if (result.recipe.id !== recipe.id || result.recipe.ingredients.length !== recipe.ingredients.length || result.recipe.instructions.length !== recipe.instructions.length) throw new Error('TRANSLATION_INTEGRITY_FAILED');
  return result;
}

async function runFallback(prompt: string): Promise<{ recipe: Recipe; provider: Provider }> {
  const failures: string[] = [];
  try { return { recipe: RecipeSchema.parse(await callMistral(prompt)), provider: 'mistral' }; } catch (error) { failures.push(`mistral:${diagnostic(error)}`); }
  try { return { recipe: RecipeSchema.parse(await callGemini(prompt)), provider: 'gemini' }; } catch (error) { failures.push(`gemini:${diagnostic(error)}`); }
  console.error('AI extraction failed', failures.join(', '));
  throw new Error('AI_EXTRACTION_FAILED');
}

async function callMistral(prompt: string): Promise<unknown> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error('MISSING_KEY');
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(22_000), headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.MISTRAL_MODEL || 'mistral-small-latest', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }) });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return parseJson(payload.choices?.[0]?.message?.content);
}

async function callGemini(prompt: string): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('MISSING_KEY');
  const model = encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(22_000), headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }) });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return parseJson(payload.candidates?.[0]?.content?.parts?.[0]?.text);
}

function parseJson(text?: string) { if (!text) throw new Error('EMPTY_RESPONSE'); return JSON.parse(text.replace(/^```json\s*|\s*```$/g, '')); }
function diagnostic(error: unknown) { return error instanceof Error ? error.message.slice(0, 160) : 'unknown'; }
