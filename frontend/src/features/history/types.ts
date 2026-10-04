import type { LanguageCode } from "@/api/types";
import type { ChatMessageItem } from "@/features/chat/conversationReducer";

export interface SavedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  language: LanguageCode;
  sessionId?: string | null;
  messages: ChatMessageItem[];
}

export type DateGroupKey = "Today" | "Yesterday" | "Previous 7 days" | "Older";

export interface ConversationGroup {
  label: DateGroupKey;
  items: SavedConversation[];
}
