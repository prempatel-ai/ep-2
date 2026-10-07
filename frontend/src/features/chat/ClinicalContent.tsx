import React, { type ReactNode } from "react";
import styles from "./ClinicalContent.module.css";

interface ClinicalContentProps {
  content: string;
  isStreaming?: boolean;
}

export interface SourceItem {
  title: string;
  url: string;
}

const TRUSTED_SOURCES: { match: RegExp; url: string }[] = [
  { match: /HealthCareMagic/i, url: "https://www.healthcaremagic.com" },
  { match: /National Cancer Institute|NCI/i, url: "https://www.cancer.gov/types/breast" },
  { match: /MedlinePlus/i, url: "https://medlineplus.gov/breastcancer.html" },
  { match: /American Cancer Society/i, url: "https://www.cancer.org/cancer/types/breast-cancer.html" },
  { match: /National Breast Cancer Foundation/i, url: "https://www.nationalbreastcancer.org/breast-cancer-myths/" },
  { match: /Susan G\.? Komen/i, url: "https://www.komen.org/breast-cancer/" },
  { match: /World Health Organization|WHO/i, url: "https://www.who.int/news-room/fact-sheets/detail/breast-cancer" },
  { match: /CDC/i, url: "https://www.cdc.gov/cancer/breast/" },
];

export function resolveSourceUrl(title: string): string {
  for (const entry of TRUSTED_SOURCES) {
    if (entry.match.test(title)) {
      return entry.url;
    }
  }
  return `https://medlineplus.gov/search.html?query=${encodeURIComponent(title)}`;
}

export function parseSources(text: string): SourceItem[] {
  const cleaned = text.replace(/^Sources?:\s*/i, "").trim();
  if (!cleaned) return [];

  const rawTokens = cleaned.split(/\s*[,;·•]\s*/).filter(Boolean);
  const items: SourceItem[] = [];

  for (const tok of rawTokens) {
    const trimmed = tok.trim();
    if (trimmed) {
      items.push({
        title: trimmed,
        url: resolveSourceUrl(trimmed),
      });
    }
  }

  return items;
}

function parseInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className={styles.strongText}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.inlineLink}
        >
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

type Block =
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbers"; items: string[] }
  | { type: "sources"; text: string; items: SourceItem[] }
  | { type: "paragraph"; lines: string[] };

function prepareContent(content: string): string {
  // Ensure "Sources:" starts on its own line if preceded by non-newline text
  return content.replace(/([^\n])\s*(Sources?:\s*)/gi, "$1\n\n$2");
}

function parseBlocks(content: string): Block[] {
  const prepared = prepareContent(content);
  const rawLines = prepared.split(/\r?\n/);
  const blocks: Block[] = [];
  let currentParagraph: string[] = [];
  let currentBullets: string[] = [];
  let currentNumbers: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: "paragraph", lines: [...currentParagraph] });
      currentParagraph = [];
    }
  };
  const flushBullets = () => {
    if (currentBullets.length > 0) {
      blocks.push({ type: "bullets", items: [...currentBullets] });
      currentBullets = [];
    }
  };
  const flushNumbers = () => {
    if (currentNumbers.length > 0) {
      blocks.push({ type: "numbers", items: [...currentNumbers] });
      currentNumbers = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushNumbers();
  };

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushAll();
      continue;
    }

    if (/^#{1,4}\s+/.test(trimmed)) {
      flushAll();
      const text = trimmed.replace(/^#+\s*/, "");
      blocks.push({ type: "heading", text });
      continue;
    }

    if (/^Sources?:\s*/i.test(trimmed)) {
      flushAll();
      const items = parseSources(trimmed);
      blocks.push({ type: "sources", text: trimmed, items });
      continue;
    }

    if (/^[•*-]\s+/.test(trimmed)) {
      flushParagraph();
      flushNumbers();
      currentBullets.push(trimmed.replace(/^[•*-]\s+/, ""));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      flushBullets();
      currentNumbers.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    // Regular line
    flushBullets();
    flushNumbers();
    currentParagraph.push(trimmed);
  }

  flushAll();
  return blocks;
}

export function ClinicalContent({ content, isStreaming = false }: ClinicalContentProps) {
  if (!content) return null;

  const blocks = parseBlocks(content);
  const sourcesBlock = blocks.find((b): b is Extract<Block, { type: "sources" }> => b.type === "sources");
  const firstSource = sourcesBlock?.items[0];
  const totalSources = sourcesBlock?.items.length ?? 0;

  return (
    <div className={`${styles.container} ${isStreaming ? styles.isStreaming : ""}`}>
      {firstSource && (
        <div className={styles.topSourceBadge} title="Verified against clinical oncology database">
          <span className={styles.topSourceIcon} aria-hidden="true">🩺</span>
          <span className={styles.topSourceText}>
            {firstSource.title.length > 32 ? `${firstSource.title.slice(0, 30)}...` : firstSource.title}
            {totalSources > 1 ? ` +${totalSources - 1}` : ""}
          </span>
        </div>
      )}

      {blocks.map((block, blockIndex) => {
        const isLastBlock = blockIndex === blocks.length - 1;

        if (block.type === "heading") {
          return (
            <h4 key={blockIndex} className={styles.subheading}>
              {parseInline(block.text)}
              {isLastBlock && isStreaming && (
                <span className={styles.streamingCursor} aria-hidden="true" />
              )}
            </h4>
          );
        }

        if (block.type === "numbers") {
          return (
            <ol key={blockIndex} className={styles.numberedList}>
              {block.items.map((itemText, lineIdx) => {
                const isLastItem = lineIdx === block.items.length - 1;
                return (
                  <li key={lineIdx} className={styles.numberedItem}>
                    {parseInline(itemText)}
                    {isLastBlock && isLastItem && isStreaming && (
                      <span className={styles.streamingCursor} aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ol>
          );
        }

        if (block.type === "bullets") {
          return (
            <ul key={blockIndex} className={styles.bulletList}>
              {block.items.map((itemText, lineIdx) => {
                const isLastItem = lineIdx === block.items.length - 1;
                return (
                  <li key={lineIdx} className={styles.bulletItem}>
                    <span className={styles.bulletDot} aria-hidden="true">•</span>
                    <span>
                      {parseInline(itemText)}
                      {isLastBlock && isLastItem && isStreaming && (
                        <span className={styles.streamingCursor} aria-hidden="true" />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }

        if (block.type === "sources") {
          return (
            <div
              key={blockIndex}
              className={styles.sourcesSection}
              role="region"
              aria-label="Verified clinical sources"
            >
              <span className={styles.sourcesHeader}>Sources:</span>
              <div className={styles.sourcesList}>
                {block.items.map((item, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className={styles.sourceSeparator} aria-hidden="true">·</span>}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sourceItem}
                      title={`Verified reference: ${item.title}`}
                    >
                      <span className={styles.sourceTitle}>{item.title}</span>
                      <span className={styles.sourceArrow} aria-hidden="true">↗</span>
                    </a>
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        }

        return (
          <p key={blockIndex} className={styles.paragraph}>
            {block.lines.map((line, lineIdx, arr) => {
              const isLastLine = lineIdx === arr.length - 1;
              return (
                <React.Fragment key={lineIdx}>
                  {parseInline(line)}
                  {isLastBlock && isLastLine && isStreaming && (
                    <span className={styles.streamingCursor} aria-hidden="true" />
                  )}
                  {lineIdx < arr.length - 1 && <br />}
                </React.Fragment>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
