import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ClinicalContent, parseSources, resolveSourceUrl } from "./ClinicalContent";

describe("ClinicalContent", () => {
  it("resolves verified URLs for recognized clinical oncology entities", () => {
    expect(resolveSourceUrl("HealthCareMagic Physician Consultations")).toBe(
      "https://www.healthcaremagic.com",
    );
    expect(resolveSourceUrl("NIH / National Cancer Institute & MedlinePlus")).toContain(
      "cancer.gov",
    );
    expect(resolveSourceUrl("American Cancer Society")).toBe(
      "https://www.cancer.org/cancer/types/breast-cancer.html",
    );
  });

  it("parses source strings into clean title and url pairs", () => {
    const raw = "Sources: HealthCareMagic Physician Consultations, NIH / National Cancer Institute & MedlinePlus";
    const items = parseSources(raw);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("HealthCareMagic Physician Consultations");
    expect(items[1].title).toBe("NIH / National Cancer Institute & MedlinePlus");
  });

  it("renders structured headings, lists, bold text, and source chips matching ChatGPT/Claude", () => {
    const content = `
Best 5 facts for breast awareness:

1. Early detection improves survival outcomes.
2. Mammograms are low-dose X-rays.

Sources: American Cancer Society, WHO
    `.trim();

    render(<ClinicalContent content={content} />);

    expect(screen.getByText("Best 5 facts for breast awareness:")).toBeDefined();
    expect(screen.getByText("Early detection improves survival outcomes.")).toBeDefined();
    expect(screen.getByText("Mammograms are low-dose X-rays.")).toBeDefined();
    expect(screen.getByText("Sources:")).toBeDefined();

    const acsLink = screen.getByRole("link", { name: /American Cancer Society/i });
    expect(acsLink.getAttribute("href")).toBe("https://www.cancer.org/cancer/types/breast-cancer.html");
    expect(acsLink.getAttribute("target")).toBe("_blank");

    const whoLink = screen.getByRole("link", { name: /WHO/i });
    expect(whoLink.getAttribute("href")).toBe("https://www.who.int/news-room/fact-sheets/detail/breast-cancer");
  });

  it("renders top verified source badge when sources exist", () => {
    const content = `
A biopsy is a small tissue sample.

Sources: NIH / National Cancer Institute & MedlinePlus
    `.trim();

    render(<ClinicalContent content={content} />);

    const badge = screen.getByTitle("Verified against clinical oncology database");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("NIH / National Cancer");
  });
});
