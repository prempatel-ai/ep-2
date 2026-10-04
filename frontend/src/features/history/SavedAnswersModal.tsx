"use client";

import React, { useState, useEffect } from "react";
import { Bookmark, X, Trash2, Copy, Check } from "lucide-react";
import { getSavedAnswers, removeSavedAnswer, type SavedAnswer } from "./savedAnswersStorage";
import styles from "./SavedAnswersModal.module.css";

interface SavedAnswersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SavedAnswersModal({ isOpen, onClose }: SavedAnswersModalProps) {
  const [answers, setAnswers] = useState<SavedAnswer[]>(() => getSavedAnswers());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDelete = (id: string) => {
    removeSavedAnswer(id);
    setAnswers((prev) => prev.filter((a) => a.id !== id));
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Saved answers">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <Bookmark size={18} className={styles.titleIcon} aria-hidden="true" />
            <h2 className={styles.title}>Saved answers</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close saved answers"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.content}>
          {answers.length === 0 ? (
            <div className={styles.emptyState}>
              <Bookmark size={32} strokeWidth={1.5} color="#9ca3af" />
              <p className={styles.emptyTitle}>No saved answers yet</p>
              <p className={styles.emptyText}>
                Click the bookmark icon on any medical answer in a conversation to save it here for quick clinical reference.
              </p>
            </div>
          ) : (
            answers.map((item) => (
              <div key={item.id} className={styles.answerCard}>
                <div className={styles.questionRow}>
                  <span className={styles.questionText}>{item.question}</span>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.id, item.text)}
                      className={styles.actionButton}
                      title="Copy answer"
                      aria-label="Copy answer"
                    >
                      {copiedId === item.id ? (
                        <Check size={14} color="#0d9488" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                      title="Remove from saved answers"
                      aria-label="Remove answer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className={styles.answerText}>{item.text}</p>
                <div className={styles.metaRow}>
                  <span>Source: {item.source ? item.source.toUpperCase() : "Clinical Model"}</span>
                  <span>{new Date(item.savedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
