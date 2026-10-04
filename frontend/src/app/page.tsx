"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/features/chat/ChatView";
import { VoiceView } from "@/features/voice/VoiceView";
import type { LanguageCode } from "@/api/types";

export default function Home() {
  const [language, setLanguage] = useState<LanguageCode>("gu");
  const [activeMode, setActiveMode] = useState<"text" | "voice">("text");

  return (
    <AppShell currentLanguage={language} onLanguageChange={setLanguage}>
      {activeMode === "voice" ? (
        <VoiceView
          currentLanguage={language}
          onExitVoice={() => setActiveMode("text")}
        />
      ) : (
        <ChatView
          currentLanguage={language}
          onLanguageChange={setLanguage}
          onSwitchToVoice={() => setActiveMode("voice")}
        />
      )}
    </AppShell>
  );
}
