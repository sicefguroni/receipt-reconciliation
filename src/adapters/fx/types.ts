import type { FxRate } from "@/core/currency";

// The FX boundary (04). Rates are "1 unit of currency = audPerUnit AUD" on a business day.
// Weekend and holiday gaps are expected; src/core picks the right rate (R-CUR-2).

export interface FxClient {
  getRates(currency: string, from: string, to: string): Promise<FxRate[]>;
}

export class FxError extends Error {
  constructor(
    readonly code: "FX_API_ERROR" | "FX_RECORDING_MISSING",
    message: string,
  ) {
    super(message);
    this.name = "FxError";
  }
}
