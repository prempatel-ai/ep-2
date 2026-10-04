import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Composer } from "./Composer";

describe("Composer Microphone & Input Controls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders Dictate, Voice conversation, and Select microphone buttons when input is empty", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();
    const handleSwitchToVoice = vi.fn();

    render(
      <Composer
        isSubmitting={false}
        onSend={handleSend}
        onStop={handleStop}
        onSwitchToVoice={handleSwitchToVoice}
      />,
    );

    expect(screen.getByRole("button", { name: "Dictate" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Voice conversation" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Select microphone" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
  });

  it("transitions immediately to Send button when user types text", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();
    const handleSwitchToVoice = vi.fn();

    render(
      <Composer
        isSubmitting={false}
        onSend={handleSend}
        onStop={handleStop}
        onSwitchToVoice={handleSwitchToVoice}
      />,
    );

    const textarea = screen.getByRole("textbox", {
      name: "Ask a medical information question",
    });

    // Enter single character
    fireEvent.change(textarea, { target: { value: "W" } });

    // Voice & mic controls disappear
    expect(screen.queryByRole("button", { name: "Dictate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Voice conversation" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Select microphone" })).toBeNull();

    // Send button appears
    expect(screen.getByRole("button", { name: "Send message" })).toBeDefined();
  });

  it("reverts back to voice controls when text is cleared", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();
    const handleSwitchToVoice = vi.fn();

    render(
      <Composer
        isSubmitting={false}
        onSend={handleSend}
        onStop={handleStop}
        onSwitchToVoice={handleSwitchToVoice}
      />,
    );

    const textarea = screen.getByRole("textbox", {
      name: "Ask a medical information question",
    });

    // Type text
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(screen.getByRole("button", { name: "Send message" })).toBeDefined();

    // Clear text
    fireEvent.change(textarea, { target: { value: "" } });

    // Controls return
    expect(screen.getByRole("button", { name: "Dictate" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Voice conversation" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Select microphone" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
  });

  it("treats whitespace-only text as empty", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer isSubmitting={false} onSend={handleSend} onStop={handleStop} />,
    );

    const textarea = screen.getByRole("textbox", {
      name: "Ask a medical information question",
    });

    fireEvent.change(textarea, { target: { value: "   " } });

    // Whitespace still shows voice controls, not send button
    expect(screen.getByRole("button", { name: "Dictate" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
  });

  it("toggles microphone selection popover menu, selects device, and closes on Escape", async () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();
    const handleSwitchToVoice = vi.fn();

    render(
      <Composer
        isSubmitting={false}
        onSend={handleSend}
        onStop={handleStop}
        onSwitchToVoice={handleSwitchToVoice}
      />,
    );

    const chevronBtn = screen.getByRole("button", { name: "Select microphone" });
    fireEvent.click(chevronBtn);

    // Menu should be open
    expect(screen.getByRole("menu", { name: "Microphone selection menu" })).toBeDefined();
    const realtekMic = screen.getByRole("menuitemradio", {
      name: /Microphone Array \(Realtek\(R\) Audio\)/,
    });
    expect(realtekMic).toBeDefined();

    // Select second device
    const defaultSysMic = screen.getByRole("menuitemradio", {
      name: /Default - Microphone Array/,
    });
    fireEvent.click(defaultSysMic);

    await waitFor(() => {
      expect(localStorage.getItem("sahayak_selected_mic_id")).toBe("default-sys");
    });

    // Pressing Escape closes menu
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Microphone selection menu" })).toBeNull();
  });

  it("submits message on Enter and ignores Shift+Enter", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer isSubmitting={false} onSend={handleSend} onStop={handleStop} />,
    );

    const textarea = screen.getByRole("textbox", {
      name: "Ask a medical information question",
    });

    fireEvent.change(textarea, { target: { value: "What is screening?" } });

    // Shift+Enter does not submit
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(handleSend).not.toHaveBeenCalled();

    // Plain Enter submits
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(handleSend).toHaveBeenCalledWith("What is screening?");
  });
});
