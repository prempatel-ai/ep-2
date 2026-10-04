import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("AppShell Scaffold", () => {
  it("renders header title and status indicator", () => {
    render(<AppShell currentLanguage="en" />);
    expect(screen.getByText("Sahayak")).toBeDefined();
    expect(screen.getByText("Connected")).toBeDefined();
  });

  it("renders Gujarati title when Gujarati language is selected", () => {
    render(<AppShell currentLanguage="gu" />);
    expect(screen.getByText("સહાયક")).toBeDefined();
  });

  it("renders Hindi title when Hindi language is selected", () => {
    render(<AppShell currentLanguage="hi" />);
    expect(screen.getByText("सहायक")).toBeDefined();
  });

  it("renders mandatory clinical disclaimer and emergency hotline numbers", () => {
    render(<AppShell currentLanguage="en" />);
    expect(screen.getByText(/This tool provides clinical information only/)).toBeDefined();
    expect(screen.getByText(/112 \(National Emergency\)/)).toBeDefined();
  });
});
