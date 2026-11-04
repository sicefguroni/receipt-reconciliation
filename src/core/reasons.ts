// Reasons a person gives for a decision (R-AMT-4, R-MAT-7, R-MAT-3, R-DUP-1).
// Day 4 (C1): every sign-off in the builder's run said "Good", including three pairings of a
// receipt with an unrelated payment. A reason has to say something.

export const MIN_REASON_CHARS = 8;

const GENERIC = new Set([
  "good",
  "ok",
  "okay",
  "fine",
  "yes",
  "done",
  "approved",
  "approve",
  "valid",
  "correct",
  "checked",
  "verified",
  "confirmed",
  "agree",
  "agreed",
  "monthly",
  "misc",
  "other",
  "same",
  "test",
  "na",
  "n/a",
  "none",
  "nil",
  "all",
  "very",
  "looks",
  "is",
  "it",
]);

/** Null when the reason is specific enough; otherwise what is wrong with it, for the person. */
export function reasonProblem(reason: string | null | undefined): string | null {
  const text = reason?.trim() ?? "";
  if (text.length < MIN_REASON_CHARS) {
    return `at least ${MIN_REASON_CHARS} characters`;
  }
  const words = text
    .toLowerCase()
    .split(/[^a-z/]+/)
    .filter(Boolean);
  if (words.length > 0 && words.every((w) => GENERIC.has(w))) {
    return 'saying what happened, not just "good" or "ok"';
  }
  return null;
}

export function isSpecificReason(reason: string | null | undefined): boolean {
  return reasonProblem(reason) === null;
}
