"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  ChevronLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  Activity,
  ShieldCheck,
  FileText,
  Pill,
  Bookmark,
  Settings,
} from "lucide-react";
import type { LanguageCode } from "@/api/types";
import type { SavedConversation } from "./types";
import { groupConversations } from "./storage";
import { getSavedAnswers } from "./savedAnswersStorage";
import { SavedAnswersModal } from "./SavedAnswersModal";
import { SettingsModal } from "./SettingsModal";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  conversations: SavedConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearAllData?: () => void;
  isOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  isLoaded?: boolean;
  onExploreTopic?: (topic: "symptoms" | "screening" | "diagnosis" | "treatment") => void;
  currentLanguage?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  isOnline?: boolean;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onClearAllData,
  isOpen,
  onToggleCollapse,
  onCloseMobile,
  isLoaded = true,
  onExploreTopic,
  currentLanguage = "en",
  onLanguageChange,
  isOnline = true,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSavedAnswersOpen, setIsSavedAnswersOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savedAnswersCount, setSavedAnswersCount] = useState<number>(0);

  // Synchronize saved answers count safely on mount and when storage updates
  useEffect(() => {
    const updateCount = () => {
      setSavedAnswersCount(getSavedAnswers().length);
    };
    updateCount();
    window.addEventListener("sahayak_saved_answers_changed", updateCount);
    window.addEventListener("storage", updateCount);
    return () => {
      window.removeEventListener("sahayak_saved_answers_changed", updateCount);
      window.removeEventListener("storage", updateCount);
    };
  }, [isSavedAnswersOpen]);

  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const displayedConversations = isLoaded ? conversations : [];
  const grouped = groupConversations(displayedConversations);

  // Close context menu on outside click or Escape, handle mobile drawer escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpenId(null);
        setConfirmDeleteId(null);
        setEditingId(null);
        if (isOpen && typeof window !== "undefined" && window.innerWidth < 768) {
          if (onCloseMobile) onCloseMobile();
          else onToggleCollapse();
        }
      }
    };

    if (menuOpenId || confirmDeleteId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpenId, confirmDeleteId, isOpen, onCloseMobile, onToggleCollapse]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (conv: SavedConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setMenuOpenId(null);
    setConfirmDeleteId(null);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = () => {
    setEditingId(null);
  };

  const handleStartDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
    setMenuOpenId(null);
  };

  const handleConfirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteConversation(id);
    setConfirmDeleteId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const handleItemClick = (id: string) => {
    if (editingId) return;
    onSelectConversation(id);
    if (
      typeof window !== "undefined" &&
      window.innerWidth < 768
    ) {
      if (onCloseMobile) onCloseMobile();
      else onToggleCollapse();
    }
  };

  const handleTopicClick = (topic: "symptoms" | "screening" | "diagnosis" | "treatment") => {
    if (onExploreTopic) {
      onExploreTopic(topic);
    }
    if (
      typeof window !== "undefined" &&
      window.innerWidth < 768
    ) {
      if (onCloseMobile) onCloseMobile();
      else onToggleCollapse();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={onCloseMobile || onToggleCollapse}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : styles.sidebarClosed}`}
        aria-label="Application navigation"
      >
        {/* Top Header of Sidebar */}
        <div className={styles.sidebarHeader}>
          <div className={styles.brandGroup}>
            <div className={styles.brandIcon} aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="8" y="2" width="4" height="16" rx="2" fill="#0d9488" />
                <rect x="2" y="8" width="16" height="4" rx="2" fill="#0d9488" />
              </svg>
            </div>
            <div className={styles.brandTextGroup}>
              <span className={styles.brandTitle}>SAHAYAK</span>
              <span className={styles.brandSubtitle}>
                Breast Cancer Information Assistant
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className={styles.collapseButton}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Primary Action: + New conversation */}
        <div className={styles.newChatWrapper}>
          <button
            type="button"
            onClick={() => {
              onNewConversation();
              if (
                typeof window !== "undefined" &&
                window.innerWidth < 768
              ) {
                if (onCloseMobile) onCloseMobile();
                else onToggleCollapse();
              }
            }}
            className={styles.newChatButton}
            aria-label="Create new conversation"
          >
            <Plus size={15} aria-hidden="true" />
            <span>New conversation</span>
          </button>
        </div>

        {/* Scrollable Navigation & History Area */}
        <div className={styles.navScrollArea} suppressHydrationWarning>
          {/* SECTION 1: CONVERSATIONS */}
          <div className={styles.navSection}>
            <span className={styles.sectionHeader}>CONVERSATIONS</span>

            {/* Saved answers item */}
            <button
              type="button"
              onClick={() => setIsSavedAnswersOpen(true)}
              className={styles.navItem}
              title="View bookmarked clinical answers"
              suppressHydrationWarning
            >
              <Bookmark size={14} className={styles.navItemIcon} aria-hidden="true" />
              <span>Saved answers</span>
              {savedAnswersCount > 0 && (
                <span className={styles.itemBadge} suppressHydrationWarning>
                  {savedAnswersCount}
                </span>
              )}
            </button>

            {/* Recent Conversations List */}
            {!isLoaded || displayedConversations.length === 0 ? (
              <div className={styles.emptyHistory}>
                <span>No recent conversations</span>
              </div>
            ) : (
              <div className={styles.groupsContainer}>
                {grouped.map((group) => (
                  <div key={group.label} className={styles.groupSection}>
                    <div className={styles.groupHeading}>{group.label}</div>
                    <div className={styles.groupList}>
                      {group.items.map((conv) => {
                        const isActive = conv.id === activeConversationId;
                        const isEditing = editingId === conv.id;
                        const isConfirming = confirmDeleteId === conv.id;
                        const isMenuOpen = menuOpenId === conv.id;

                        if (isEditing) {
                          return (
                            <div
                              key={conv.id}
                              className={`${styles.itemContainer} ${styles.itemEditing}`}
                            >
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveRename(conv.id);
                                  if (e.key === "Escape") handleCancelRename();
                                }}
                                className={styles.renameInput}
                                maxLength={60}
                                aria-label="Rename conversation"
                              />
                              <div className={styles.renameActions}>
                                <button
                                  type="button"
                                  onClick={() => handleSaveRename(conv.id)}
                                  className={styles.renameActionBtn}
                                  aria-label="Save title"
                                  title="Save"
                                >
                                  <Check size={13} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelRename}
                                  className={styles.renameActionBtn}
                                  aria-label="Cancel rename"
                                  title="Cancel"
                                >
                                  <X size={13} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          );
                        }

                        if (isConfirming) {
                          return (
                            <div
                              key={conv.id}
                              className={`${styles.itemContainer} ${styles.itemConfirming}`}
                            >
                              <span className={styles.confirmPrompt}>Delete?</span>
                              <div className={styles.confirmActions}>
                                <button
                                  type="button"
                                  onClick={(e) => handleConfirmDelete(conv.id, e)}
                                  className={styles.confirmDeleteBtn}
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelDelete}
                                  className={styles.confirmCancelBtn}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={conv.id}
                            className={`${styles.itemContainer} ${
                              isActive ? styles.itemActive : ""
                            }`}
                            onClick={() => handleItemClick(conv.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleItemClick(conv.id);
                            }}
                            aria-current={isActive ? "true" : undefined}
                          >
                            <span className={styles.itemTitle} title={conv.title}>
                              {conv.title}
                            </span>

                            <div className={styles.itemMenuTriggerWrapper}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(isMenuOpen ? null : conv.id);
                                }}
                                className={`${styles.itemMenuTrigger} ${
                                  isMenuOpen ? styles.itemMenuTriggerActive : ""
                                }`}
                                aria-label="Conversation options"
                                title="More options"
                              >
                                <MoreHorizontal size={14} aria-hidden="true" />
                              </button>

                              {/* Dropdown menu for item */}
                              {isMenuOpen && (
                                <div
                                  ref={menuRef}
                                  className={styles.contextMenu}
                                  role="menu"
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className={styles.contextMenuItem}
                                    onClick={(e) => handleStartRename(conv, e)}
                                  >
                                    <Pencil size={13} aria-hidden="true" />
                                    <span>Rename</span>
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`}
                                    onClick={(e) => handleStartDelete(conv.id, e)}
                                  >
                                    <Trash2 size={13} aria-hidden="true" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: EXPLORE */}
          <div className={styles.navSection}>
            <span className={styles.sectionHeader}>EXPLORE</span>
            <nav className={styles.exploreNav}>
              <button
                type="button"
                onClick={() => handleTopicClick("symptoms")}
                className={styles.navItem}
                title="Questions about breast cancer symptoms"
              >
                <Activity size={14} className={styles.navItemIcon} aria-hidden="true" />
                <span>Symptoms</span>
              </button>
              <button
                type="button"
                onClick={() => handleTopicClick("screening")}
                className={styles.navItem}
                title="Mammogram and screening guidelines"
              >
                <ShieldCheck size={14} className={styles.navItemIcon} aria-hidden="true" />
                <span>Screening</span>
              </button>
              <button
                type="button"
                onClick={() => handleTopicClick("diagnosis")}
                className={styles.navItem}
                title="Diagnostic tests and staging terminology"
              >
                <FileText size={14} className={styles.navItemIcon} aria-hidden="true" />
                <span>Diagnosis</span>
              </button>
              <button
                type="button"
                onClick={() => handleTopicClick("treatment")}
                className={styles.navItem}
                title="Standard breast cancer treatment options"
              >
                <Pill size={14} className={styles.navItemIcon} aria-hidden="true" />
                <span>Treatment</span>
              </button>
            </nav>
          </div>
        </div>

        {/* BOTTOM: Local/Offline Status & Settings */}
        <div className={styles.sidebarFooter}>
          <div className={styles.statusBlock}>
            <div className={styles.statusRow}>
              <span
                className={isOnline ? styles.statusDotOnline : styles.statusDotOffline}
                aria-hidden="true"
              />
              <span className={styles.statusLabel}>
                {isOnline ? "Local · Connected" : "Local · Offline"}
              </span>
            </div>
            <span className={styles.privacyNote}>
              Conversations stored on this device
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={styles.settingsButton}
            aria-label="Open settings"
          >
            <Settings size={14} aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Modals */}
      <SavedAnswersModal
        isOpen={isSavedAnswersOpen}
        onClose={() => {
          setIsSavedAnswersOpen(false);
          if (typeof window !== "undefined") {
            setSavedAnswersCount(getSavedAnswers().length);
          }
        }}
      />

      {onLanguageChange && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
          conversationsCount={displayedConversations.length}
          onClearAllData={() => {
            if (onClearAllData) {
              onClearAllData();
            } else {
              localStorage.clear();
              window.location.reload();
            }
          }}
          isOnline={isOnline}
        />
      )}
    </>
  );
}
