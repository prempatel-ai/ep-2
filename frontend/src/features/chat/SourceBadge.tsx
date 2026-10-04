import type { AnswerSource } from "@/api/types";
import styles from "./SourceBadge.module.css";

interface SourceBadgeProps {
  source: AnswerSource;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const getDetails = (src: AnswerSource) => {
    switch (src) {
      case "safety":
        return {
          label: "Clinical safety protocol",
          className: styles.badgeSafety,
          title: "Pre-screened safety guidance for high-risk or acute clinical queries",
        };
      case "faq":
        return {
          label: "Verified source",
          className: styles.badgeFaq,
          title: "Direct match against clinically vetted breast cancer guidelines",
        };
      case "model":
        return {
          label: "Synthesized response",
          className: styles.badgeModel,
          title: "Synthesized guidance from offline medical knowledge base",
        };
    }
  };

  const details = getDetails(source);

  return (
    <span
      className={`${styles.badge} ${details.className}`}
      title={details.title}
      data-testid={`source-badge-${source}`}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.text}>{details.label}</span>
    </span>
  );
}
