export const supportedLanguages = [
  ['auto', 'Auto / Keep Original'],
  ['en', 'English'],
  ['ms', 'Bahasa Melayu'],
  ['de', 'Deutsch'],
  ['fr', 'Français'],
  ['es', 'Español'],
  ['it', 'Italiano'],
  ['pt', 'Português'],
  ['nl', 'Nederlands'],
  ['zh', '中文'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['th', 'ไทย'],
  ['id', 'Bahasa Indonesia'],
  ['tr', 'Türkçe'],
  ['ar', 'العربية'],
  ['hi', 'हिन्दी'],
] as const;

export const supportedLanguageCodes = [
  'en', 'ms', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'zh', 'ja', 'ko', 'th', 'id', 'tr', 'ar', 'hi',
] as const;

export type LanguageSelection = (typeof supportedLanguages)[number][0];

export function languagePromptName(code: string): string {
  if (code === 'auto') {
    return 'the recipe source language; detect it and preserve it';
  }
  return supportedLanguages.find(([value]) => value === code)?.[1] ?? code;
}
