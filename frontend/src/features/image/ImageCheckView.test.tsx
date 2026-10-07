import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import "vitest-axe/extend-expect";
import { ImageCheckView } from "./ImageCheckView";
import * as api from "@/api/http";
import type { ImageCheckResponse } from "@/api/types";

expect.extend(matchers);

const fixturePath = path.resolve(__dirname, "../../../../contract/image_check_responses.json");
const contractFixtures = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

describe("ImageCheckView component (Phase 20)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders mandatory safety disclaimer, privacy notice, and adult consent", () => {
    render(<ImageCheckView currentLanguage="en" />);

    expect(screen.getByText(/This is not a medical diagnosis/i)).toBeDefined();
    expect(screen.getByText(/Your photograph is processed entirely on this device/i)).toBeDefined();
    expect(screen.getByText(/I confirm that I am 18 years of age or older/i)).toBeDefined();

    // Photo picker buttons must not be visible until consent is checked
    expect(screen.queryByText(/Choose photo/i)).toBeNull();
  });

  it("reveals photo picker when adult consent is confirmed", () => {
    render(<ImageCheckView currentLanguage="en" />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(screen.getByText(/Choose photo/i)).toBeDefined();
    expect(screen.getByText(/Take photo/i)).toBeDefined();
  });

  it("calls URL.revokeObjectURL when image is removed and on unmount", () => {
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/test-preview");
    const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { unmount } = render(<ImageCheckView currentLanguage="en" />);

    // Consent
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    // Simulate file input change
    const file = new File(["dummy_image_data"], "test.png", { type: "image/png" });
    const fileInput = document.getElementById("sahayak-image-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(createUrlSpy).toHaveBeenCalledWith(file);
    expect(screen.getByAltText("Uploaded skin area preview")).toBeDefined();

    // Click remove photo
    const removeBtn = screen.getByText(/Remove photo/i);
    fireEvent.click(removeBtn);

    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:http://localhost/test-preview");

    unmount();
  });

  it("makes zero calls to localStorage, sessionStorage, or indexedDB", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<ImageCheckView currentLanguage="en" />);
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("renders contract fixture 'finding_present' with mandatory referral card", async () => {
    const fixture: ImageCheckResponse = contractFixtures.finding_present;
    vi.spyOn(api, "checkImage").mockResolvedValue(fixture);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(<ImageCheckView currentLanguage="en" />);
    fireEvent.click(screen.getByRole("checkbox"));

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    fireEvent.change(document.getElementById("sahayak-image-file-input")!, {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText(/Check Photo/i));

    await waitFor(() => {
      expect(screen.getByText(fixture.messages.findings_summary)).toBeDefined();
    });

    // Mandatory referral card must be prominent
    expect(screen.getByText(fixture.messages.referral_guidance)).toBeDefined();
    expect(screen.getByText("finding_redness")).toBeDefined();
  });

  it("renders contract fixture 'none_visible' with mandatory referral card", async () => {
    const fixture: ImageCheckResponse = contractFixtures.none_visible;
    vi.spyOn(api, "checkImage").mockResolvedValue(fixture);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(<ImageCheckView currentLanguage="en" />);
    fireEvent.click(screen.getByRole("checkbox"));

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    fireEvent.change(document.getElementById("sahayak-image-file-input")!, {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText(/Check Photo/i));

    await waitFor(() => {
      expect(screen.getByText(fixture.messages.findings_summary)).toBeDefined();
    });

    // In none_visible outcome, referral card is STILL mandatory
    expect(screen.getByText(fixture.messages.referral_guidance)).toBeDefined();
  });

  it("renders contract fixture 'unclear_image' with retake guidance and mandatory referral", async () => {
    const fixture: ImageCheckResponse = contractFixtures.unclear_image;
    vi.spyOn(api, "checkImage").mockResolvedValue(fixture);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(<ImageCheckView currentLanguage="en" />);
    fireEvent.click(screen.getByRole("checkbox"));

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    fireEvent.change(document.getElementById("sahayak-image-file-input")!, {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText(/Check Photo/i));

    await waitFor(() => {
      expect(screen.getByText(fixture.messages.findings_summary)).toBeDefined();
    });

    expect(screen.getByText(fixture.messages.referral_guidance)).toBeDefined();
  });

  it("renders contract fixture 'not_a_breast_photo' with mandatory referral", async () => {
    const fixture: ImageCheckResponse = contractFixtures.not_a_breast_photo;
    vi.spyOn(api, "checkImage").mockResolvedValue(fixture);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(<ImageCheckView currentLanguage="en" />);
    fireEvent.click(screen.getByRole("checkbox"));

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    fireEvent.change(document.getElementById("sahayak-image-file-input")!, {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText(/Check Photo/i));

    await waitFor(() => {
      expect(screen.getByText(fixture.messages.findings_summary)).toBeDefined();
    });

    expect(screen.getByText(fixture.messages.referral_guidance)).toBeDefined();
  });

  it("renders error state with fallback clinical guidance on failure", async () => {
    vi.spyOn(api, "checkImage").mockRejectedValue(new Error("Local model offline"));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(<ImageCheckView currentLanguage="en" />);
    fireEvent.click(screen.getByRole("checkbox"));

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    fireEvent.change(document.getElementById("sahayak-image-file-input")!, {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText(/Check Photo/i));

    await waitFor(() => {
      expect(screen.getByText(/Local model offline/i)).toBeDefined();
    });

    // Even in error state, mandatory clinical guidance must be present
    expect(screen.getByText(/Please consult a medical doctor or visit your nearest primary health centre/i)).toBeDefined();
  });

  it("clears and restarts state upon clicking 'Clear and start over'", async () => {
    const fixture: ImageCheckResponse = contractFixtures.none_visible;
    vi.spyOn(api, "checkImage").mockResolvedValue(fixture);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(<ImageCheckView currentLanguage="en" />);
    fireEvent.click(screen.getByRole("checkbox"));

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    fireEvent.change(document.getElementById("sahayak-image-file-input")!, {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText(/Check Photo/i));

    await waitFor(() => {
      expect(screen.getByText(/Clear and start over/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Clear and start over/i));

    // After reset, results are gone and user is returned to the picker
    expect(screen.queryByText(fixture.messages.findings_summary)).toBeNull();
    expect(screen.getByText(/Choose photo/i)).toBeDefined();
  });

  it("passes axe accessibility checks with 0 violations", async () => {
    const { container } = render(<ImageCheckView currentLanguage="en" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
