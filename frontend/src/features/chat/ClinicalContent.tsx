import React, { type ReactNode } from "react";
import styles from "./ClinicalContent.module.css";

interface ClinicalContentProps {
  content: string;
}

function parseInline(text: string): ReactNode[] {
  // Matches **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className={styles.strongText}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

type Block =
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbers"; items: string[] }
  | { type: "paragraph"; lines: string[] };

function parseBlocks(content: string): Block[] {
  const rawLines = content.split(/\r?\n/);
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

export function ClinicalContent({ content }: ClinicalContentProps) {
  if (!content) return null;

  const blocks = parseBlocks(content);

  return (
    <div className={styles.container}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          return (
            <h4 key={blockIndex} className={styles.subheading}>
              {parseInline(block.text)}
            </h4>
          );
        }

        if (block.type === "numbers") {
          return (
            <ol key={blockIndex} className={styles.numberedList}>
              {block.items.map((itemText, lineIdx) => (
                <li key={lineIdx} className={styles.numberedItem}>
                  {parseInline(itemText)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "bullets") {
          return (
            <ul key={blockIndex} className={styles.bulletList}>
              {block.items.map((itemText, lineIdx) => (
                <li key={lineIdx} className={styles.bulletItem}>
                  <span className={styles.bulletDot} aria-hidden="true">•</span>
                  <span>{parseInline(itemText)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex} className={styles.paragraph}>
            {block.lines.map((line, lineIdx, arr) => (
              <React.Fragment key={lineIdx}>
                {parseInline(line)}
                {lineIdx < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
