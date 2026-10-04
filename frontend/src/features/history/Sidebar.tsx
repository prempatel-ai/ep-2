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
} from "lucide-react";
import type { SavedConversation } from "./types";
import { groupConversations } from "./storage";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  conversations: SavedConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  isOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  isLoaded?: boolean;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  isOpen,
  onToggleCollapse,
  onCloseMobile,
  isLoaded = true,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const displayedConversations = isLoaded ? conversations : [];
  const grouped = groupConversations(displayedConversations);

  // Close context menu on outside click or Escape
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
      }
    };

    if (menuOpenId || confirmDeleteId) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpenId, confirmDeleteId]);

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
      onCloseMobile &&
      typeof window !== "undefined" &&
      window.innerWidth <= 768
    ) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : styles.sidebarClosed}`}
        aria-label="Conversation history"
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
            <span className={styles.brandText}>SAHAYAK</span>
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
                onCloseMobile &&
                typeof window !== "undefined" &&
                window.innerWidth <= 768
              ) {
                onCloseMobile();
              }
            }}
            className={styles.newChatButton}
            aria-label="Create new conversation"
          >
            <Plus size={15} aria-hidden="true" />
            <span>New conversation</span>
          </button>
        </div>

        {/* Scrollable Conversation History */}
        <div className={styles.historyScrollArea} suppressHydrationWarning>
          {!isLoaded || displayedConversations.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>No conversations yet.</p>
              <p className={styles.emptySubtitle}>
                Start a conversation with Sahayak.
              </p>
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

        {/* Data Safety Notice Footer */}
        <div className={styles.sidebarFooter}>
          <span className={styles.privacyNote}>
            Conversations are stored locally on this device.
          </span>
        </div>
      </aside>
    </>
  );
}
