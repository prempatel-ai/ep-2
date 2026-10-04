import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import type { LanguageCode } from "@/api/types";
import type { SavedConversation } from "./types";
import {
  loadAllConversations,
  saveAllConversations,
  STORAGE_KEY_ACTIVE_CONV,
  sanitizeMessagesForStorage,
} from "./storage";

const emptySubscribe = () => () => {};

export function useConversationHistory(
  onLanguageChange?: (lang: LanguageCode) => void,
) {
  const isLoaded = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const [conversations, setConversations] = useState<SavedConversation[]>(() => {
    return loadAllConversations();
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_CONV);
    }
    return null;
  });

  // Sync language when active conversation changes
  useEffect(() => {
    if (activeConversationId && onLanguageChange) {
      const active = conversations.find((c) => c.id === activeConversationId);
      if (active && active.language) {
        onLanguageChange(active.language);
      }
    }
  }, [activeConversationId, conversations, onLanguageChange]);

  const activeConversation = useMemo(() => {
    if (!isLoaded || !activeConversationId) return null;
    return conversations.find((c) => c.id === activeConversationId) || null;
  }, [isLoaded, conversations, activeConversationId]);

  const createNewConversation = useCallback(() => {
    setActiveConversationId(null);
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_CONV);
    }
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      const found = conversations.find((c) => c.id === id);
      if (!found) return;

      setActiveConversationId(id);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY_ACTIVE_CONV, id);
      }
      if (onLanguageChange && found.language) {
        onLanguageChange(found.language);
      }
    },
    [conversations, onLanguageChange],
  );

  const saveConversation = useCallback((conv: SavedConversation) => {
    const sanitizedMessages = sanitizeMessagesForStorage(conv.messages);
    if (sanitizedMessages.length === 0) return;

    const toSave: SavedConversation = {
      ...conv,
      messages: sanitizedMessages,
      updatedAt: Date.now(),
    };

    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === toSave.id);
      let updated: SavedConversation[];
      if (index >= 0) {
        updated = [...prev];
        updated[index] = toSave;
      } else {
        updated = [toSave, ...prev];
      }
      saveAllConversations(updated);
      return updated;
    });

    setActiveConversationId(toSave.id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_ACTIVE_CONV, toSave.id);
    }
  }, []);

  const renameConversation = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, title: trimmed, updatedAt: Date.now() } : c,
      );
      saveAllConversations(updated);
      return updated;
    });
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        saveAllConversations(updated);
        return updated;
      });

      if (activeConversationId === id) {
        setActiveConversationId(null);
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(STORAGE_KEY_ACTIVE_CONV);
        }
      }
    },
    [activeConversationId],
  );

  return {
    conversations,
    activeConversationId,
    activeConversation,
    isLoaded,
    createNewConversation,
    selectConversation,
    saveConversation,
    renameConversation,
    deleteConversation,
  };
}
