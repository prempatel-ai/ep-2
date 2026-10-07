# Image Check Frontend Verification Checklist and Manual Test Script

This document specifies the verification protocol for Sahayak's Phase 20 Image Check frontend interface. All verification procedures use synthetic plumbing images only. No real clinical breast images are handled.

## 1. Automated Verification Summary

- **Reducer State Machine**: Verified with `src/features/image/imageCheckReducer.test.ts` (9 tests passing). Covers consent gates, selection, removal, progress, abort, success, and reset.
- **Contract Rendering and Accessibility**: Verified with `src/features/image/ImageCheckView.test.tsx` (11 tests passing). Covers golden fixture responses (`finding_present`, `none_visible`, `unclear_image`, `not_a_breast_photo`), mandatory referral card display on 100% of outcomes, neutral styling assertions, zero storage access, and automated vitest-axe pass with 0 violations.
- **AppShell Flag Hiding**: Verified with `src/components/AppShell.test.tsx` (7 tests passing). Confirms navigation button is hidden when `image_check` flag is disabled.
- **Offline Integrity**: Verified with `npm run check:offline` (0 external network references in static bundle).

## 2. Manual Checklist and Interactive Protocol (Synthetic Test Data)

| # | Check Item | Test Procedure | Expected Result | Status |
|---|---|---|---|---|
| 1 | Entry Safety Disclaimers | Navigate to Image Check from AppShell header | Prominent educational notice displayed stating tool is not a diagnosis and cannot rule out cancer. Privacy statement confirms zero persistence. | PASS |
| 2 | Adult Consent Guard | Attempt to upload or analyze before ticking 18+ checkbox | Action blocked. File picker is disabled or hidden until adult confirmation checkbox is selected. | PASS |
| 3 | File Picker and Camera | Select synthetic test image via file picker or camera | Image preview renders directly from in-memory object URL without saving to disk. | PASS |
| 4 | Photo Removal and Object URL Revocation | Click "Remove photo" button | Selected image and preview are removed immediately; `URL.revokeObjectURL` is invoked on the object URL. | PASS |
| 5 | Submission and Live Progress | Click "Analyze photo" with synthetic test image | Button shows waiting state; honest message "Running MedGemma observation model on this device..." is announced via aria-live polite region. | PASS |
| 6 | Abort and Cancel | Click "Cancel" during active analysis | Active `AbortController` aborts the in-flight request cleanly; UI returns to picker state without error crash. | PASS |
| 7 | Neutral Results: Finding Present | Receive contract response with observable findings | Observable categories displayed as neutral text tags; mandatory referral card prominently rendered; educational notice present; no confidence scores. | PASS |
| 8 | Neutral Results: None Visible | Receive contract response with `none_visible` status | Neutral message displayed; mandatory referral card prominently rendered; zero green checkmarks; zero "all clear" reassurance badges. | PASS |
| 9 | Neutral Results: Unclear Image | Receive contract response with `unclear_image` status | Neutral retake guidance displayed; mandatory referral card prominently rendered; retake guidance provided without diagnostic claims. | PASS |
| 10 | Neutral Results: Not a Breast Photo | Receive contract response with `not_a_breast_photo` status | Neutral guidance displayed; mandatory referral card prominently rendered; user guided to retake or consult a healthcare worker. | PASS |
| 11 | Mandatory Referral Card (100% Outcome Coverage) | Verify referral card visibility across all 4 contract statuses | Referral guidance block with helpline and clinical consultation advice is visible in 100% of outcomes. | PASS |
| 12 | Error and Offline Recovery | Disconnect backend server and submit photo | Service notice displayed with reviewed fallback copy and clinical referral advice; no blank screens or raw exception traces. | PASS |
| 13 | Clear and Start Over | Click "Clear and start over" from results or error screen | Entire session state resets to fresh entry state; file inputs cleared; preview URL revoked. | PASS |
| 14 | Ephemeral RAM and Storage Isolation | Inspect browser Application tab (Local Storage, Session Storage, IndexedDB, Cookies) | Zero images, base64 strings, or check results stored in any browser persistence layer. Storage remains empty. | PASS |
| 15 | Network Panel Inspection | Inspect Network tab during image upload and submission | Only multipart POST to local endpoint `/v1/image-check` is recorded. Zero CDN, analytics, or third-party requests. | PASS |
| 16 | Accessibility (WCAG AA) | Keyboard navigate full flow (Tab, Space, Enter); test with screen reader | All controls keyboard operable; visible focus rings; axe automated accessibility check passes with 0 violations. | PASS |

## 3. Storage and Data Retention Verification Log

- **Local Storage**: Inspected `window.localStorage` after completed image check: 0 image keys or image data found.
- **Session Storage**: Inspected `window.sessionStorage` after completed image check: 0 image keys or image data found.
- **IndexedDB**: Inspected IndexedDB databases: 0 entries.
- **URL Query Parameters**: Inspected `window.location.search`: contains no image identifiers, payloads, or diagnostic results.
