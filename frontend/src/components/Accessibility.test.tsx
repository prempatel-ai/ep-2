import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import "vitest-axe/extend-expect";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface Assertion<R, T> {
    toHaveNoViolations(): void;
  }
}

import { AppShell } from "./AppShell";
import { SourceBadge } from "@/features/chat/SourceBadge";
import { MessageList } from "@/features/chat/MessageList";

expect.extend(matchers);

describe("Accessibility Audit (WCAG AA Compliance)", () => {
  it("AppShell passes axe accessibility checks with no violations", async () => {
    const { container } = render(
      <AppShell currentLanguage="en">
        <section aria-label="Test Section">
          <h2>Test Workspace</h2>
          <p>Clinical guidance content</p>
        </section>
      </AppShell>,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("SourceBadge variants have accessible structure and contrast indicators", async () => {
    const { container } = render(
      <div>
        <SourceBadge source="safety" />
        <SourceBadge source="faq" />
        <SourceBadge source="model" />
      </div>,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("MessageList empty state passes axe accessibility checks", async () => {
    const { container } = render(
      <MessageList messages={[]} />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("MessageList conversation stream with assistant responses passes axe checks", async () => {
    const { container } = render(
      <MessageList
        messages={[
          {
            id: "u-1",
            role: "user",
            text: "What are the common symptoms of breast cancer?",
            state: "complete",
            timestamp: 1000,
          },
          {
            id: "a-1",
            role: "assistant",
            text: "Common symptoms include a painless lump or thickening in the breast.",
            state: "complete",
            source: "faq",
            timestamp: 1001,
          },
        ]}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
