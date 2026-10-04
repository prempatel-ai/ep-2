import type { AnswerSource } from "@/api/types";

export interface SavedAnswer {
  id: string;
  question: string;
  text: string;
  source?: AnswerSource;
  savedAt: number;
}

const STORAGE_KEY_SAVED_ANSWERS = "sahayak_saved_answers_v1";

export function getSavedAnswers(): SavedAnswer[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_ANSWERS);
    if (!raw) return [];
    return JSON.parse(raw) as SavedAnswer[];
  } catch {
    return [];
  }
}

export function saveAnswer(answer: Omit<SavedAnswer, "savedAt"> & { savedAt?: number }): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    const existing = getSavedAnswers();
    const filtered = existing.filter((a) => a.id !== answer.id);
    const fullAnswer: SavedAnswer = {
      ...answer,
      savedAt: answer.savedAt ?? Date.now(),
    };
    const updated = [fullAnswer, ...filtered];
    localStorage.setItem(STORAGE_KEY_SAVED_ANSWERS, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

export function removeSavedAnswer(id: string): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    const existing = getSavedAnswers();
    const updated = existing.filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEY_SAVED_ANSWERS, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export function isAnswerSaved(id: string): boolean {
  const existing = getSavedAnswers();
  return existing.some((a) => a.id === id);
}
