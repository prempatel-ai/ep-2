export const en = {
  app: {
    title: "Sahayak",
    subtitle: "Breast Cancer Information Assistant",
    tagline: "Offline multilingual health guidance in Gujarati, Hindi, and English",
  },
  disclaimer: {
    notice:
      "This tool provides clinical information only and does not replace professional medical judgment.",
    emergency:
      "If you are experiencing severe pain, urgent symptoms, or a medical emergency, please contact local emergency services immediately: 112 (National Emergency) or 14416 (Tele-MANAS).",
  },
  header: {
    statusOnline: "Connected",
    statusOffline: "Offline",
    newConversation: "New conversation",
  },
  composer: {
    placeholder: "Ask a question about breast cancer symptoms, screening, or treatment...",
    send: "Send message",
    speak: "Start voice turn",
    stop: "Stop response",
  },
  source: {
    safety: "Clinical safety protocol",
    faq: "Verified source",
    model: "Synthesized response",
  },
  imageCheck: {
    navButton: "Image check",
    title: "Visible Skin Change Check",
    subtitle: "Local observational awareness aid",
    warningNotice:
      "This is not a medical diagnosis. An image check cannot detect or rule out breast cancer.",
    privacyNotice:
      "Your photograph is processed entirely on this device and is never saved, stored, or transmitted anywhere.",
    adultConsent:
      "I confirm that I am 18 years of age or older and understand that this tool is not a medical diagnosis.",
    choosePhoto: "Choose photo",
    useCamera: "Take photo",
    changePhoto: "Change photo",
    removePhoto: "Remove photo",
    supportedFormats: "Supported formats: JPEG, PNG, WebP (up to 10 MB)",
    analyzingTitle: "Analyzing image locally...",
    analyzingMessage:
      "Running MedGemma observation model on this device. This may take several seconds.",
    cancelAnalysis: "Cancel",
    clearAndStartOver: "Clear and start over",
    findingsHeading: "Observable surface skin categories",
    referralHeading: "Mandatory Clinical Guidance",
    educationalDisclaimerHeading: "Notice",
    retakeGuidanceHeading: "Photo Quality Guidance",
    errorHeading: "Service Notice",
  },
};

export type TranslationKeys = typeof en;
