import type { ExceptionCode, FileMime } from "./schemas";

// Receipt quality gate R-QUA-1 to R-QUA-4 (docs/sprint/05-business-rules.md).

export interface QualityPolicy {
  minLongSide: number; // px
  minShortSide: number; // px
  /** Sharpness below this fails a raster photo. Unset: the blur check is not configured. */
  minSharpness?: number;
}

export interface FileFacts {
  mime: FileMime;
  width?: number;
  height?: number;
  /** A sharpness score from the file adapter (higher is sharper), raster photos only. */
  sharpness?: number | null;
}

export type QualityResult =
  | { ok: true; blurChecked: boolean }
  | { ok: false; exception: "UNREADABLE"; reason: string };

/**
 * R-QUA-2: blur checks apply only to raster photos. PDFs carry text, and PNG screenshots are
 * crisp renders with embedded text, so neither is blur-checked (E5: a crisp PDF was rejected).
 */
export function blurCheckApplies(mime: FileMime): boolean {
  return mime === "image/jpeg";
}

/**
 * R-QUA-1 (Day 4, candidate's ruling): the size floor applies to camera photos only, like the
 * blur check. A small PNG screenshot is still crisp, and "retake it closer" is wrong advice for
 * one; the model reads it and flags anything it cannot read (stress S03).
 */
export function sizeCheckApplies(mime: FileMime): boolean {
  return mime === "image/jpeg";
}

/**
 * R-QUA-1: orientation-aware size check (long side and short side), so a portrait scan is
 * judged the same as a landscape one. PDFs and screenshots skip it.
 * R-QUA-3: a failure gives the measured size and a fix in plain language.
 */
export function checkQuality(file: FileFacts, policy: QualityPolicy): QualityResult {
  if (sizeCheckApplies(file.mime) && file.width && file.height) {
    const long = Math.max(file.width, file.height);
    const short = Math.min(file.width, file.height);
    if (long < policy.minLongSide || short < policy.minShortSide) {
      return {
        ok: false,
        exception: "UNREADABLE",
        reason: `Photo is ${file.width} × ${file.height}. Retake it closer, or upload the original PDF.`,
      };
    }
  }

  const blurChecked =
    blurCheckApplies(file.mime) && policy.minSharpness !== undefined && file.sharpness != null;
  if (blurChecked && (file.sharpness ?? 0) < (policy.minSharpness ?? 0)) {
    return {
      ok: false,
      exception: "UNREADABLE",
      reason: "Photo is too blurry to read. Retake it in good light, holding the phone still.",
    };
  }
  return { ok: true, blurChecked };
}

/** R-QUA-4: the model may report that the file is not a receipt at all. */
export function checkIsReceipt(isReceipt: boolean): ExceptionCode[] {
  return isReceipt ? [] : ["NOT_A_RECEIPT"];
}
