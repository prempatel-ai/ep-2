"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/features/chat/ChatView";
import { VoiceView } from "@/features/voice/VoiceView";
import { Sidebar } from "@/features/history/Sidebar";
import { useConversationHistory } from "@/features/history/useConversationHistory";
import type { LanguageCode } from "@/api/types";

export default function Home() {
  const [language, setLanguage] = useState<LanguageCode>("gu");
  const [activeMode, setActiveMode] = useState<"text" | "voice">("text");
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth > 768;
    }
    return true;
  });

  const history = useConversationHistory(setLanguage);

  const [chatSessionKey, setChatSessionKey] = useState<string>(
    () => history.activeConversationId || "init",
  );

  const handleNewConversation = () => {
    setActiveMode("text");
    history.createNewConversation();
    setChatSessionKey(`new_${Date.now()}`);
  };

  const handleSelectConversation = (id: string) => {
    setActiveMode("text");
    history.selectConversation(id);
    setChatSessionKey(id);
  };

  return (
    <AppShell
      currentLanguage={language}
      onLanguageChange={setLanguage}
      activeMode={activeMode}
      onSwitchToVoice={() => setActiveMode("voice")}
      onNewConversation={handleNewConversation}
      isSidebarOpen={isSidebarOpen}
      onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      activeConversationTitle={history.activeConversation?.title || null}
      sidebar={
        <Sidebar
          conversations={history.conversations}
          activeConversationId={history.activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onRenameConversation={history.renameConversation}
          onDeleteConversation={history.deleteConversation}
          isOpen={isSidebarOpen}
          onToggleCollapse={() => setIsSidebarOpen(false)}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />
      }
    >
      {activeMode === "voice" ? (
        <VoiceView
          currentLanguage={language}
          onExitVoice={() => setActiveMode("text")}
        />
      ) : (
        <ChatView
          key={chatSessionKey}
          currentLanguage={language}
          onLanguageChange={setLanguage}
          onSwitchToVoice={() => setActiveMode("voice")}
          activeConversation={history.activeConversation}
          onSaveConversation={history.saveConversation}
          onNewConversation={handleNewConversation}
        />
      )}
    </AppShell>
  );
}
