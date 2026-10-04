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
          label: "Safety protocol",
          title: "Pre-screened safety guidance for high-risk clinical queries",
        };
      case "faq":
        return {
          label: "Verified guidance",
          title: "Direct match against clinically vetted breast cancer guidelines",
        };
      case "model":
        return {
          label: "Local model",
          title: "Synthesized guidance from on-device medical model",
        };
    }
  };

  const details = getDetails(source);

  return (
    <span
      className={styles.provenanceGroup}
      title={details.title}
      data-testid={`source-badge-${source}`}
    >
      <span className={styles.dot} aria-hidden="true">·</span>
      <span className={styles.text}>{details.label}</span>
    </span>
  );
}
