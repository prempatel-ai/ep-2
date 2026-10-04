"use client";

import { useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/features/chat/ChatView";
import { VoiceView } from "@/features/voice/VoiceView";
import { Sidebar } from "@/features/history/Sidebar";
import { useConversationHistory } from "@/features/history/useConversationHistory";
import type { LanguageCode } from "@/api/types";

const emptySubscribe = () => () => {};

export default function Home() {
  const [language, setLanguage] = useState<LanguageCode>("gu");
  const [activeMode, setActiveMode] = useState<"text" | "voice">("text");

  const isMobile = useSyncExternalStore(
    emptySubscribe,
    () => window.innerWidth <= 768,
    () => false,
  );
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const isSidebarOpen = sidebarOverride !== null ? sidebarOverride : !isMobile;

  const history = useConversationHistory(setLanguage);

  const [chatSessionKey, setChatSessionKey] = useState<string>("init");

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
      onToggleSidebar={() => setSidebarOverride(!isSidebarOpen)}
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
          onToggleCollapse={() => setSidebarOverride(false)}
          onCloseMobile={() => setSidebarOverride(false)}
          isLoaded={history.isLoaded}
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
