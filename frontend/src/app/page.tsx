"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { LanguageCode } from "@/api/types";

export default function Home() {
  const [language, setLanguage] = useState<LanguageCode>("gu");

  return (
    <AppShell currentLanguage={language} onLanguageChange={setLanguage}>
      <section
        style={{
          padding: "var(--space-8) 0",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-6)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <h2
            style={{
              fontSize: "var(--font-size-md)",
              fontWeight: "var(--font-weight-semibold)",
              marginBottom: "var(--space-2)",
            }}
          >
            Multilingual Typography Verification
          </h2>
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-4)",
            }}
          >
            Verify that Gujarati, Hindi, and English native scripts render cleanly with the local font stack.
          </p>

          <div
            style={{
              display: "grid",
              gap: "var(--space-4)",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            <div
              style={{
                border: "1px solid var(--color-border)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-tertiary)",
                  display: "block",
                  marginBottom: "var(--space-1)",
                }}
              >
                ગુજરાતી (Gujarati)
              </span>
              <p
                lang="gu"
                style={{
                  fontFamily: "var(--font-gujarati)",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-relaxed)",
                }}
              >
                સ્તન કેન્સરની તપાસ અને પ્રાથમિક માહિતી માટે સહાયક.
              </p>
            </div>

            <div
              style={{
                border: "1px solid var(--color-border)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-tertiary)",
                  display: "block",
                  marginBottom: "var(--space-1)",
                }}
              >
                हिन्दी (Hindi)
              </span>
              <p
                lang="hi"
                style={{
                  fontFamily: "var(--font-devanagari)",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-relaxed)",
                }}
              >
                स्तन कैंसर की जांच और शुरुआती जानकारी के लिए सहायक।
              </p>
            </div>

            <div
              style={{
                border: "1px solid var(--color-border)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-tertiary)",
                  display: "block",
                  marginBottom: "var(--space-1)",
                }}
              >
                English
              </span>
              <p
                lang="en"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-relaxed)",
                }}
              >
                Verified breast cancer FAQ assistance for patients and families.
              </p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
