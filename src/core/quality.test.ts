import { describe, expect, it } from "vitest";
import { blurCheckApplies, checkIsReceipt, checkQuality, type QualityPolicy } from "./quality";

const policy: QualityPolicy = { minLongSide: 1000, minShortSide: 700 };

describe("R-QUA receipt quality gate", () => {
  it("R-QUA-1: a 900 × 1200 portrait phone photo passes (TC08)", () => {
    expect(checkQuality({ mime: "image/jpeg", width: 900, height: 1200 }, policy).ok).toBe(true);
  });

  it("R-QUA-1: orientation does not matter: 1200 × 900 passes the same way", () => {
    expect(checkQuality({ mime: "image/jpeg", width: 1200, height: 900 }, policy).ok).toBe(true);
  });

  it("R-QUA-1: the smallest dataset photo (750 × 1000) is exactly at the limits and passes", () => {
    expect(checkQuality({ mime: "image/jpeg", width: 750, height: 1000 }, policy).ok).toBe(true);
  });

  it("R-QUA-1: a short side under 700 fails", () => {
    expect(checkQuality({ mime: "image/jpeg", width: 600, height: 1200 }, policy).ok).toBe(false);
  });

  it("R-QUA-1: a long side under 1000 fails", () => {
    expect(checkQuality({ mime: "image/png", width: 800, height: 999 }, policy).ok).toBe(false);
  });

  it("R-QUA-1: a PDF has no pixel size and skips the size check", () => {
    expect(checkQuality({ mime: "application/pdf" }, policy).ok).toBe(true);
  });

  it("R-QUA-2: a crisp PDF is never blur-checked, even with a low score (TC09)", () => {
    const strict = { ...policy, minSharpness: 100 };
    expect(checkQuality({ mime: "application/pdf", sharpness: 1 }, strict)).toEqual({
      ok: true,
      blurChecked: false,
    });
    expect(blurCheckApplies("application/pdf")).toBe(false);
    expect(blurCheckApplies("image/png")).toBe(false);
  });

  it("R-QUA-2: a raster photo is blur-checked when a threshold is configured", () => {
    const strict = { ...policy, minSharpness: 100 };
    const photo = { mime: "image/jpeg" as const, width: 900, height: 1200 };
    expect(checkQuality({ ...photo, sharpness: 250 }, strict)).toEqual({
      ok: true,
      blurChecked: true,
    });
    expect(checkQuality({ ...photo, sharpness: 40 }, strict).ok).toBe(false);
  });

  it("R-QUA-3: a failure states the measured size and the fix", () => {
    expect(checkQuality({ mime: "image/jpeg", width: 600, height: 820 }, policy)).toEqual({
      ok: false,
      exception: "UNREADABLE",
      reason: "Photo is 600 × 820. Retake it closer, or upload the original PDF.",
    });
  });

  it("R-QUA-4: isReceipt false flags NOT_A_RECEIPT", () => {
    expect(checkIsReceipt(false)).toEqual(["NOT_A_RECEIPT"]);
    expect(checkIsReceipt(true)).toEqual([]);
  });
});
