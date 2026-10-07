"use client";

import React, { useReducer, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Camera,
  X,
  RotateCcw,
  AlertCircle,
  Activity,
  Shield,
  ArrowLeft,
} from "lucide-react";
import type { LanguageCode } from "@/api/types";
import { getTranslation } from "@/i18n";
import { checkImage } from "@/api/http";
import {
  imageCheckReducer,
  initialImageCheckState,
} from "./imageCheckReducer";
import styles from "./ImageCheckView.module.css";

interface ImageCheckViewProps {
  currentLanguage?: LanguageCode;
  onExit?: () => void;
}

export function ImageCheckView({
  currentLanguage = "en",
  onExit,
}: ImageCheckViewProps) {
  const rawT = getTranslation(currentLanguage);
  const enT = getTranslation("en");
  // Fall back to reviewed English copy when translation placeholder is present
  const t = {
    ...rawT,
    imageCheck: Object.fromEntries(
      Object.entries(rawT.imageCheck).map(([k, v]) => [
        k,
        v === "[NEEDS HUMAN TRANSLATION]"
          ? (enT.imageCheck as Record<string, string>)[k] || v
          : v,
      ]),
    ) as typeof rawT.imageCheck,
  };
  const [state, dispatch] = useReducer(
    imageCheckReducer,
    initialImageCheckState,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousUrlRef = useRef<string | null>(null);

  // Safely manage and revoke in-memory object URLs to prevent memory leakage
  useEffect(() => {
    const prev = previousUrlRef.current;
    if (prev && prev !== state.previewUrl) {
      URL.revokeObjectURL(prev);
    }
    previousUrlRef.current = state.previewUrl;

    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
        previousUrlRef.current = null;
      }
    };
  }, [state.previewUrl]);

  // Cancel any ongoing network request on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      dispatch({
        type: "ANALYSIS_ERROR",
        message: "Unsupported file format. Please select a JPEG, PNG, or WebP photo.",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      dispatch({
        type: "ANALYSIS_ERROR",
        message: "File exceeds 10 MB limit. Please select a smaller photo.",
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    dispatch({ type: "SELECT_IMAGE", file, previewUrl: objectUrl });

    // Reset input value so re-selecting same file triggers change
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleRemoveImage = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    dispatch({ type: "REMOVE_IMAGE" });
  };

  const handleStartAnalysis = async () => {
    if (!state.selectedFile || !state.adultConfirmed) return;

    dispatch({ type: "START_ANALYSIS" });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await checkImage(
        state.selectedFile,
        currentLanguage,
        controller.signal,
      );
      dispatch({ type: "ANALYSIS_SUCCESS", response });
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        dispatch({ type: "ANALYSIS_CANCELLED" });
        return;
      }
      const msg =
        err instanceof Error ? err.message : "Failed to process photo analysis.";
      dispatch({ type: "ANALYSIS_ERROR", message: msg });
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: "ANALYSIS_CANCELLED" });
  }, []);

  const handleClearAndReset = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    dispatch({ type: "RESET" });
  };

  return (
    <div className={styles.container} lang={currentLanguage}>
      {/* Title & Purpose Header */}
      <div className={styles.headerBlock}>
        <div className={styles.headerRow}>
          <div className={styles.headerTextGroup}>
            <h2 className={styles.title}>{t.imageCheck.title}</h2>
            <p className={styles.subtitle}>{t.imageCheck.subtitle}</p>
          </div>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className={styles.secondaryButton}
              aria-label="Back to chat"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to chat
            </button>
          )}
        </div>
      </div>

      {/* Prominent Safety & Privacy Disclaimers */}
      <div className={styles.noticeGrid}>
        <div className={`${styles.noticeCard} ${styles.noticeWarning}`} role="note">
          <div className={styles.noticeIconWrapper} aria-hidden="true">
            <AlertCircle size={18} />
          </div>
          <div className={styles.noticeContent}>
            <h3 className={styles.noticeTitle}>
              {t.imageCheck.educationalDisclaimerHeading}
            </h3>
            <p className={styles.noticeText}>{t.imageCheck.warningNotice}</p>
          </div>
        </div>

        <div className={`${styles.noticeCard} ${styles.noticePrivacy}`} role="note">
          <div className={styles.noticeIconWrapper} aria-hidden="true">
            <Shield size={18} />
          </div>
          <div className={styles.noticeContent}>
            <h3 className={styles.noticeTitle}>Privacy</h3>
            <p className={styles.noticeText}>{t.imageCheck.privacyNotice}</p>
          </div>
        </div>
      </div>

      {/* Step 1: 18+ Adult Consent Checkbox */}
      <label
        className={`${styles.consentBox} ${
          state.adultConfirmed ? styles.consentBoxActive : ""
        }`}
      >
        <input
          type="checkbox"
          checked={state.adultConfirmed}
          onChange={(e) =>
            dispatch({ type: "CONFIRM_ADULT", confirmed: e.target.checked })
          }
          className={styles.consentCheckbox}
          aria-required="true"
        />
        <span className={styles.consentLabel}>{t.imageCheck.adultConsent}</span>
      </label>

      {/* Live Region for Status & Progress Announcements */}
      <div aria-live="polite" aria-atomic="true">
        {state.step === "analyzing" && (
          <div className={styles.analyzingBox}>
            <div className={styles.spinner} aria-hidden="true" />
            <h3 className={styles.analyzingTitle}>
              {t.imageCheck.analyzingTitle}
            </h3>
            <p className={styles.analyzingMessage}>
              {t.imageCheck.analyzingMessage}
            </p>
            <button
              type="button"
              onClick={handleCancel}
              className={styles.secondaryButton}
            >
              {t.imageCheck.cancelAnalysis}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Photo Picker & Preview (Shown when consent given and not analyzing/completed) */}
      {state.adultConfirmed &&
        (state.step === "picker" || state.step === "consent") && (
          <div className={styles.pickerSection}>
            {/* Hidden File Inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className={styles.hiddenFileInput}
              id="sahayak-image-file-input"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileChange}
              className={styles.hiddenFileInput}
              id="sahayak-image-camera-input"
            />

            {!state.previewUrl ? (
              <div className={styles.uploadArea}>
                <div className={styles.uploadIconBadge} aria-hidden="true">
                  <Upload size={26} />
                </div>
                <div className={styles.uploadTextGroup}>
                  <h3 className={styles.uploadHeading}>Upload or capture a photo</h3>
                  <p className={styles.supportedFormats}>
                    {t.imageCheck.supportedFormats}
                  </p>
                </div>
                <div className={styles.pickerButtonGroup}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={styles.primaryButton}
                  >
                    <Upload size={16} aria-hidden="true" />
                    {t.imageCheck.choosePhoto}
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className={styles.secondaryButton}
                  >
                    <Camera size={16} aria-hidden="true" />
                    {t.imageCheck.useCamera}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.previewCard}>
                <div className={styles.previewImageContainer}>
                  {/* In-memory preview only: Next Image optimization is not compatible with blob: URLs in static export */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.previewUrl}
                    alt="Uploaded skin area preview"
                    className={styles.previewImage}
                  />
                </div>
                <div className={styles.previewActions}>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className={styles.dangerButton}
                  >
                    <X size={14} aria-hidden="true" />
                    {t.imageCheck.removePhoto}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartAnalysis}
                    className={styles.primaryButton}
                  >
                    <Activity size={16} aria-hidden="true" />
                    Check Photo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Step 3: Results Display */}
      {state.step === "result" && state.result && (
        <div className={styles.resultSection} aria-live="polite">
          {/* Findings Summary Card */}
          <div className={styles.resultCard}>
            <h3 className={styles.cardHeading}>
              {t.imageCheck.findingsHeading}
            </h3>
            <p className={styles.cardText}>
              {state.result.messages.findings_summary}
            </p>

            {/* Structured Observation Category Tags (Neutral Styling) */}
            {state.result.findings && state.result.findings.length > 0 && (
              <ul
                className={styles.findingsTagList}
                aria-label="Observed categories"
              >
                {state.result.findings.map((f) => (
                  <li key={f} className={styles.findingTag}>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mandatory Clinical Referral Card - 100% Present Across Every Outcome */}
          <div className={styles.referralCard} role="alert">
            <h3 className={styles.referralHeading}>
              {t.imageCheck.referralHeading}
            </h3>
            <p className={styles.referralText}>
              {state.result.messages.referral_guidance}
            </p>
          </div>

          {/* Disclaimer Card */}
          <div className={styles.resultCard}>
            <h3 className={styles.cardHeading}>
              {t.imageCheck.educationalDisclaimerHeading}
            </h3>
            <p className={styles.cardText}>
              {state.result.messages.educational_disclaimer}
            </p>
          </div>

          {/* Action Bar: Clear & Start Over */}
          <div className={styles.bottomActionBar}>
            <button
              type="button"
              onClick={handleClearAndReset}
              className={styles.secondaryButton}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {t.imageCheck.clearAndStartOver}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Error State Display */}
      {state.step === "error" && (
        <div className={styles.resultSection} role="alert" aria-live="polite">
          <div className={styles.errorCard}>
            <h3 className={styles.errorHeading}>
              <AlertCircle size={16} aria-hidden="true" />
              {" "}
              {t.imageCheck.errorHeading}
            </h3>
            <p className={styles.errorText}>
              {state.errorMessage || "An error occurred during evaluation."}
            </p>
          </div>

          {/* Mandatory Clinical Guidance Fallback */}
          <div className={styles.referralCard}>
            <h3 className={styles.referralHeading}>
              {t.imageCheck.referralHeading}
            </h3>
            <p className={styles.referralText}>
              Please consult a medical doctor or visit your nearest primary health
              centre for an in-person clinical examination.
            </p>
          </div>

          <div className={styles.bottomActionBar}>
            <button
              type="button"
              onClick={handleClearAndReset}
              className={styles.secondaryButton}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {t.imageCheck.clearAndStartOver}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
