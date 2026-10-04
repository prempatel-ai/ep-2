import { en, type TranslationKeys } from "./en";
import { gu } from "./gu";
import { hi } from "./hi";
import type { LanguageCode } from "../api/types";

export const translations: Record<LanguageCode, TranslationKeys> = {
  en,
  gu,
  hi,
};

export function getTranslation(lang: LanguageCode): TranslationKeys {
  return translations[lang] || en;
}

export type { TranslationKeys };
