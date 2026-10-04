"use client";

import { useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/features/chat/ChatView";
import { VoiceView } from "@/features/voice/VoiceView";
import { Sidebar } from "@/features/history/Sidebar";
import { useConversationHistory } from "@/features/history/useConversationHistory";
import type { LanguageCode } from "@/api/types";

const emptySubscribe = () => () => {};

const EXPLORE_TOPIC_PROMPTS = {
  symptoms: "What are the common early symptoms and signs of breast cancer?",
  screening: "How often should women get a mammogram, and what screening tests are recommended?",
  diagnosis: "What do breast cancer stages and diagnostic biopsy results mean?",
  treatment: "What are the standard treatment options for breast cancer?",
} as const;

export default function Home() {
  const [language, setLanguage] = useState<LanguageCode>("gu");
  const [activeMode, setActiveMode] = useState<"text" | "voice">("text");

  const isMobile = useSyncExternalStore(
    emptySubscribe,
    () => window.innerWidth <= 700,
    () => false,
  );
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const isSidebarOpen = sidebarOverride !== null ? sidebarOverride : !isMobile;

  const history = useConversationHistory(setLanguage);

  const [chatSessionKey, setChatSessionKey] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const handleNewConversation = () => {
    setActiveMode("text");
    setInitialPrompt(null);
    history.createNewConversation();
    setChatSessionKey(`new_${Date.now()}`);
  };

  const handleSelectConversation = (id: string) => {
    setActiveMode("text");
    setInitialPrompt(null);
    history.selectConversation(id);
    setChatSessionKey(id);
  };

  const handleExploreTopic = (topic: "symptoms" | "screening" | "diagnosis" | "treatment") => {
    setActiveMode("text");
    history.createNewConversation();
    const prompt = EXPLORE_TOPIC_PROMPTS[topic];
    setInitialPrompt(prompt);
    setChatSessionKey(`explore_${topic}_${Date.now()}`);
  };

  const handleClearAllData = () => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
      window.location.reload();
    }
  };

  const activeKey =
    chatSessionKey ?? (history.activeConversation?.id || "empty");

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
          onClearAllData={handleClearAllData}
          isOpen={isSidebarOpen}
          onToggleCollapse={() => setSidebarOverride(false)}
          onCloseMobile={() => setSidebarOverride(false)}
          isLoaded={history.isLoaded}
          onExploreTopic={handleExploreTopic}
          currentLanguage={language}
          onLanguageChange={setLanguage}
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
          key={activeKey}
          currentLanguage={language}
          onLanguageChange={setLanguage}
          onSwitchToVoice={() => setActiveMode("voice")}
          activeConversation={history.activeConversation}
          onSaveConversation={history.saveConversation}
          onNewConversation={handleNewConversation}
          initialPrompt={initialPrompt ?? undefined}
        />
      )}
    </AppShell>
  );
}
