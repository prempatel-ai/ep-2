"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/features/chat/ChatView";
import type { LanguageCode } from "@/api/types";

export default function Home() {
  const [language, setLanguage] = useState<LanguageCode>("gu");

  return (
    <AppShell currentLanguage={language} onLanguageChange={setLanguage}>
      <ChatView
        currentLanguage={language}
        onLanguageChange={setLanguage}
      />
    </AppShell>
  );
}
