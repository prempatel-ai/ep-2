import { describe, it, expect, beforeEach } from "vitest";
import {
  generateConversationTitle,
  sanitizeMessagesForStorage,
  groupConversations,
  loadAllConversations,
  saveAllConversations,
  STORAGE_KEY_CONVERSATIONS,
} from "./storage";
import type { SavedConversation } from "./types";
import type { ChatMessageItem } from "@/features/chat/conversationReducer";

describe("Conversation History Storage & Logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("generateConversationTitle", () => {
    it("generates concise clinical title for mammogram questions", () => {
      const title = generateConversationTitle(
        "How often should women get mammograms?",
      );
      expect(title).toBe("Mammogram screening questions");
    });

    it("generates concise clinical title for early symptoms", () => {
      const title = generateConversationTitle(
        "What are the early signs of breast cancer?",
      );
      expect(title).toBe("Breast cancer early symptoms");
    });

    it("generates concise clinical title for breast lump inquiry", () => {
      const title = generateConversationTitle("Is every breast lump cancerous?");
      expect(title).toBe("Breast lump information");
    });

    it("generates concise clinical title for cancer stages", () => {
      const title = generateConversationTitle(
        "What are the standard stages of breast cancer?",
      );
      expect(title).toBe("Breast cancer stages");
    });

    it("cleans and truncates general queries nicely", () => {
      const title = generateConversationTitle(
        "Can you explain the difference between invasive and non-invasive carcinoma?",
      );
      expect(title.length).toBeLessThanOrEqual(45);
      expect(title).toMatch(/difference between/i);
    });
  });

  describe("sanitizeMessagesForStorage", () => {
    it("filters out empty messages and streaming assistant placeholders", () => {
      const messages: ChatMessageItem[] = [
        {
          id: "u-1",
          role: "user",
          text: "Hello doctor",
          state: "complete",
          timestamp: 1000,
        },
        {
          id: "a-1",
          role: "assistant",
          text: "",
          state: "streaming",
          sentences: [],
          timestamp: 1001,
        },
        {
          id: "u-2",
          role: "user",
          text: "   ",
          state: "complete",
          timestamp: 1002,
        },
        {
          id: "a-2",
          role: "assistant",
          text: "Here is verified information.",
          state: "complete",
          timestamp: 1003,
        },
      ];

      const sanitized = sanitizeMessagesForStorage(messages);
      expect(sanitized).toHaveLength(2);
      expect(sanitized[0].id).toBe("u-1");
      expect(sanitized[1].id).toBe("a-2");
    });
  });

  describe("groupConversations", () => {
    it("groups conversations into Today, Yesterday, Previous 7 days, Older", () => {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      const dummyConvs: SavedConversation[] = [
        {
          id: "c-today",
          title: "Today Question",
          createdAt: now,
          updatedAt: now,
          language: "gu",
          messages: [
            {
              id: "u-1",
              role: "user",
              text: "Q1",
              state: "complete",
              timestamp: now,
            },
          ],
        },
        {
          id: "c-yesterday",
          title: "Yesterday Question",
          createdAt: now - oneDay,
          updatedAt: now - oneDay,
          language: "gu",
          messages: [
            {
              id: "u-2",
              role: "user",
              text: "Q2",
              state: "complete",
              timestamp: now - oneDay,
            },
          ],
        },
        {
          id: "c-7days",
          title: "3 Days Ago Question",
          createdAt: now - 3 * oneDay,
          updatedAt: now - 3 * oneDay,
          language: "en",
          messages: [
            {
              id: "u-3",
              role: "user",
              text: "Q3",
              state: "complete",
              timestamp: now - 3 * oneDay,
            },
          ],
        },
        {
          id: "c-older",
          title: "Older Question",
          createdAt: now - 15 * oneDay,
          updatedAt: now - 15 * oneDay,
          language: "hi",
          messages: [
            {
              id: "u-4",
              role: "user",
              text: "Q4",
              state: "complete",
              timestamp: now - 15 * oneDay,
            },
          ],
        },
      ];

      const groups = groupConversations(dummyConvs);
      expect(groups.map((g) => g.label)).toEqual([
        "Today",
        "Yesterday",
        "Previous 7 days",
        "Older",
      ]);
      expect(groups[0].items[0].id).toBe("c-today");
      expect(groups[1].items[0].id).toBe("c-yesterday");
      expect(groups[2].items[0].id).toBe("c-7days");
      expect(groups[3].items[0].id).toBe("c-older");
    });
  });

  describe("LocalStorage Persistence", () => {
    it("saves and reloads conversations correctly", () => {
      const convs: SavedConversation[] = [
        {
          id: "conv-1",
          title: "Mammogram screening",
          createdAt: 1000,
          updatedAt: 2000,
          language: "gu",
          messages: [
            {
              id: "u-1",
              role: "user",
              text: "Mammogram query",
              state: "complete",
              timestamp: 1000,
            },
          ],
        },
      ];

      saveAllConversations(convs);
      expect(localStorage.getItem(STORAGE_KEY_CONVERSATIONS)).toBeDefined();

      const loaded = loadAllConversations();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe("Mammogram screening");
      expect(loaded[0].messages).toHaveLength(1);
    });
  });
});
