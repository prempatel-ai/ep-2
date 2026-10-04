import type { ChatMessageItem } from "@/features/chat/conversationReducer";
import type { SavedConversation, DateGroupKey, ConversationGroup } from "./types";

export const STORAGE_KEY_CONVERSATIONS = "sahayak_conversations_v1";
export const STORAGE_KEY_ACTIVE_CONV = "sahayak_active_conversation_id";

/**
 * Generate a concise clinical title from the first user question.
 */
export function generateConversationTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "New conversation";

  const lower = trimmed.toLowerCase();

  // Clinical topic detection (English)
  if (lower.includes("mammogram") || lower.includes("screening")) {
    return "Mammogram screening questions";
  }
  if (lower.includes("early sign") || lower.includes("symptom")) {
    return "Breast cancer early symptoms";
  }
  if (lower.includes("stage") || lower.includes("staging")) {
    return "Breast cancer stages";
  }
  if (lower.includes("lump") || lower.includes("cyst")) {
    return "Breast lump information";
  }
  if (lower.includes("biopsy") || lower.includes("diagnos")) {
    return "Diagnosis & biopsy guidance";
  }
  if (
    lower.includes("treatment") ||
    lower.includes("chemo") ||
    lower.includes("radiation") ||
    lower.includes("surgery")
  ) {
    return "Treatment options";
  }
  if (lower.includes("risk") || lower.includes("genetic") || lower.includes("brca")) {
    return "Risk factors & genetics";
  }

  // Gujarati topic detection
  if (trimmed.includes("મેમોગ્રાફી") || trimmed.includes("સ્ક્રીનીંગ")) {
    return "મેમોગ્રાફી સ્ક્રીનીંગ માહિતી";
  }
  if (trimmed.includes("લક્ષણ")) {
    return "કેન્સરના પ્રારંભિક લક્ષણો";
  }
  if (trimmed.includes("ગાંઠ") || trimmed.includes("લમ્પ")) {
    return "સ્તનમાં ગાંઠ અંગે માહિતી";
  }
  if (trimmed.includes("તબક્કા") || trimmed.includes("સ્ટેજ")) {
    return "કેન્સરના તબક્કા અને સ્ટેજ";
  }

  // Hindi topic detection
  if (trimmed.includes("मैमोग्राफी") || trimmed.includes("स्क्रीनिंग")) {
    return "मैमोग्राफी स्क्रीनिंग जानकारी";
  }
  if (trimmed.includes("लक्षण")) {
    return "स्तन कैंसर के शुरुआती लक्षण";
  }
  if (trimmed.includes("गांठ")) {
    return "स्तन में गांठ संबंधी जानकारी";
  }

  // Fallback: clean question prefixes and truncate cleanly
  let cleaned = trimmed
    .replace(/^[¿?¡!.,\s]+/, "")
    .replace(/[?]+$/, "")
    .replace(
      /^(what is|what are|how often|can you tell me about|tell me about|how to|can you explain|explain|tell me)\s+/i,
      "",
    );

  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (cleaned.length > 40) {
    const sub = cleaned.substring(0, 38);
    const lastSpace = sub.lastIndexOf(" ");
    return (lastSpace > 20 ? sub.substring(0, lastSpace) : sub).trim() + "...";
  }
  return cleaned;
}

/**
 * Filter out transient streaming or empty placeholder messages before persistence.
 */
export function sanitizeMessagesForStorage(
  messages: ChatMessageItem[],
): ChatMessageItem[] {
  return messages.filter((msg) => {
    // Only persist non-empty text messages
    if (!msg.text || msg.text.trim().length === 0) return false;
    // Do not persist streaming assistant placeholders
    if (msg.role === "assistant" && msg.state === "streaming") return false;
    return true;
  });
}

/**
 * Load all conversations from local storage safely.
 */
export function loadAllConversations(): SavedConversation[] {
  if (typeof localStorage === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return (parsed as SavedConversation[])
      .filter((c) => c && c.id && Array.isArray(c.messages) && c.messages.length > 0)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

/**
 * Save all conversations to local storage safely.
 */
export function saveAllConversations(conversations: SavedConversation[]): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(
      STORAGE_KEY_CONVERSATIONS,
      JSON.stringify(conversations),
    );
  } catch {
    // ignore quota errors
  }
}

/**
 * Determine the date group for a given timestamp.
 */
export function getDateGroupKey(timestamp: number): DateGroupKey {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

  if (timestamp >= startOfToday) {
    return "Today";
  }
  if (timestamp >= startOfYesterday) {
    return "Yesterday";
  }
  if (timestamp >= startOf7Days) {
    return "Previous 7 days";
  }
  return "Older";
}

/**
 * Group conversations chronologically: Today, Yesterday, Previous 7 days, Older.
 * Only non-empty groups are returned.
 */
export function groupConversations(
  conversations: SavedConversation[],
): ConversationGroup[] {
  const groups: Record<DateGroupKey, SavedConversation[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const conv of conversations) {
    const key = getDateGroupKey(conv.updatedAt || conv.createdAt);
    groups[key].push(conv);
  }

  const order: DateGroupKey[] = [
    "Today",
    "Yesterday",
    "Previous 7 days",
    "Older",
  ];

  const result: ConversationGroup[] = [];
  for (const label of order) {
    if (groups[label].length > 0) {
      result.push({
        label,
        items: groups[label].sort((a, b) => b.updatedAt - a.updatedAt),
      });
    }
  }

  return result;
}
