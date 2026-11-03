import { toCents } from "./money";

// Duplicate rules R-DUP-1 and R-DUP-2 (docs/sprint/05-business-rules.md).

export interface DuplicateCandidate {
  id: string;
  uploadOrder: number;
  fileHash: string;
  vendor: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;
}

export interface DuplicateFlag {
  duplicateOf: string;
  reason: "same_file" | "same_details";
  /** R-DUP-1: excluded until a human decides. Never deleted (confirmed 2026-11-02). */
  excludedFromTotals: true;
}

const LEGAL_SUFFIXES = new Set(["pty", "ltd", "inc", "co", "llc", "gmbh", "limited", "plc"]);

/** Case, accents, punctuation, and legal suffixes do not make a different vendor. */
export function normaliseVendor(vendor: string): string {
  return vendor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word && !LEGAL_SUFFIXES.has(word))
    .join(" ");
}

function detailsKey(c: DuplicateCandidate): string | null {
  // Matching on details needs every field. A missing field is never treated as equal.
  if (!c.vendor || !c.date || c.total === null || !c.currency) return null;
  const vendor = normaliseVendor(c.vendor);
  if (!vendor) return null;
  return [vendor, c.date, toCents(c.total), c.currency.toUpperCase()].join("|");
}

/**
 * R-DUP-1: receipts are duplicates if their file hashes are equal, OR vendor (normalised),
 * date, total, and currency are all equal. The earliest upload is the original; each later
 * upload is flagged against it.
 * R-DUP-2: the date is part of the key, so the same vendor and amount on different dates
 * (a monthly subscription) is not a duplicate.
 */
export function findDuplicates(
  receipts: readonly DuplicateCandidate[],
): Map<string, DuplicateFlag> {
  const ordered = [...receipts].sort((a, b) => a.uploadOrder - b.uploadOrder);
  const firstByHash = new Map<string, string>();
  const firstByDetails = new Map<string, string>();
  const flags = new Map<string, DuplicateFlag>();

  for (const r of ordered) {
    const byHash = firstByHash.get(r.fileHash);
    const key = detailsKey(r);
    const byDetails = key ? firstByDetails.get(key) : undefined;

    if (byHash) {
      flags.set(r.id, { duplicateOf: byHash, reason: "same_file", excludedFromTotals: true });
    } else if (byDetails) {
      flags.set(r.id, { duplicateOf: byDetails, reason: "same_details", excludedFromTotals: true });
    }

    // Point later copies at the original, not at another copy.
    const original = flags.get(r.id)?.duplicateOf ?? r.id;
    if (!firstByHash.has(r.fileHash)) firstByHash.set(r.fileHash, original);
    if (key && !firstByDetails.has(key)) firstByDetails.set(key, original);
  }
  return flags;
}
