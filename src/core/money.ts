// Money is compared in integer cents so rules like "above $0.01" are exact.
// Amounts arrive in major units (dollars) from extraction and CSV parsing.

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

const ISO_CURRENCY = /^[A-Z]{3}$/;

export function normaliseCurrency(code: string | null | undefined): string | null {
  const upper = code?.trim().toUpperCase() ?? "";
  return ISO_CURRENCY.test(upper) ? upper : null;
}
