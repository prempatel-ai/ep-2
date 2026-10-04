"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/features/chat/ChatView";
import { VoiceView } from "@/features/voice/VoiceView";
import type { LanguageCode } from "@/api/types";

export default function Home() {
  const [language, setLanguage] = useState<LanguageCode>("gu");
  const [activeMode, setActiveMode] = useState<"text" | "voice">("text");
  const [conversationResetKey, setConversationResetKey] = useState(0);

  const handleNewConversation = () => {
    setActiveMode("text");
    setConversationResetKey((k) => k + 1);
  };

  return (
    <AppShell
      currentLanguage={language}
      onLanguageChange={setLanguage}
      activeMode={activeMode}
      onSwitchToVoice={() => setActiveMode("voice")}
      onNewConversation={handleNewConversation}
    >
      {activeMode === "voice" ? (
        <VoiceView
          currentLanguage={language}
          onExitVoice={() => setActiveMode("text")}
        />
      ) : (
        <ChatView
          key={conversationResetKey}
          currentLanguage={language}
          onLanguageChange={setLanguage}
          onSwitchToVoice={() => setActiveMode("voice")}
        />
      )}
    </AppShell>
  );
}
