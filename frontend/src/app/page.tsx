"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/features/chat/ChatView";
import { VoiceView } from "@/features/voice/VoiceView";
import { ImageCheckView } from "@/features/image/ImageCheckView";
import { Sidebar } from "@/features/history/Sidebar";
import { useConversationHistory } from "@/features/history/useConversationHistory";
import { getConfig } from "@/api/http";
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
  const [activeMode, setActiveMode] = useState<"text" | "voice" | "image">("text");
  const [imageCheckEnabled, setImageCheckEnabled] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const fetchConfig = () => {
      getConfig()
        .then((cfg) => {
          if (mounted && typeof cfg?.image_check === "boolean") {
            setImageCheckEnabled(cfg.image_check);
          }
        })
        .catch(() => {
          // If backend was still starting up, retry after 2 seconds
          if (mounted) {
            setTimeout(fetchConfig, 2000);
          }
        });
    };
    fetchConfig();
    return () => {
      mounted = false;
    };
  }, []);

  const isMobile = useSyncExternalStore(
    emptySubscribe,
    () => window.innerWidth < 768,
    () => false,
  );
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const isSidebarOpen = sidebarOverride !== null ? sidebarOverride : !isMobile;
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  const history = useConversationHistory(setLanguage);

  const [chatSessionKey, setChatSessionKey] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const handleNewConversation = () => {
    setActiveMode("text");
    setInitialPrompt(null);
    setIsDetailsOpen(false);
    history.createNewConversation();
    setChatSessionKey(`new_${Date.now()}`);
  };

  const handleSelectConversation = (id: string) => {
    setActiveMode("text");
    setInitialPrompt(null);
    setIsDetailsOpen(false);
    history.selectConversation(id);
    setChatSessionKey(id);
  };

  const handleExploreTopic = (topic: "symptoms" | "screening" | "diagnosis" | "treatment") => {
    setActiveMode("text");
    setIsDetailsOpen(false);
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
      imageCheckEnabled={imageCheckEnabled}
      onSwitchToImageCheck={() => setActiveMode("image")}
      onSwitchToTextChat={() => setActiveMode("text")}
      onNewConversation={handleNewConversation}
      isSidebarOpen={isSidebarOpen}
      onToggleSidebar={() => setSidebarOverride(!isSidebarOpen)}
      activeConversationTitle={history.activeConversation?.title || null}
      onOpenClinicalDetails={() => setIsDetailsOpen(true)}
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
      ) : activeMode === "image" ? (
        <ImageCheckView
          currentLanguage={language}
          onExit={() => setActiveMode("text")}
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
          isDetailsOpen={isDetailsOpen}
          onCloseDetails={() => setIsDetailsOpen(false)}
        />
      )}
    </AppShell>
  );
}
