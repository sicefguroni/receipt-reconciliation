import type { FxClient } from "@/adapters/fx/types";
import type { ModelCall, ModelClient, ModelResponse } from "@/adapters/model/types";
import type { FxRate } from "@/core/currency";

// An "oracle" model that answers with the ground-truth fields and category. Running the
// pipeline with it isolates the rules from perception: any wrong status or exception under
// perfect extraction is a rules or pipeline bug, not a model error. Used by tests and by
// `pnpm eval -- --mode oracle`. The expected outcomes stay hand-written, so this does not
// grade the rules against themselves.

export interface OracleReceipt {
  id: string;
  fields: {
    vendor: string;
    date: string;
    total: number;
    currency: string;
    tax: number | null;
    summary: string;
  };
  isReceipt: boolean;
  category: string;
}

export class OracleModelClient implements ModelClient {
  readonly mode = "replay" as const;
  private readonly byFile = new Map<string, OracleReceipt>();
  private readonly byVendor = new Map<string, OracleReceipt>();

  constructor(receipts: readonly OracleReceipt[], filenames: ReadonlyMap<string, string>) {
    for (const r of receipts) {
      const filename = filenames.get(r.id);
      if (filename) this.byFile.set(filename, r);
      this.byVendor.set(`${r.fields.vendor}\n${r.fields.summary}`, r);
    }
  }

  async call(request: ModelCall): Promise<ModelResponse> {
    const first = request.parts[0];
    const text = first?.kind === "text" ? first.text : "";
    const respond = (body: unknown): ModelResponse => ({
      text: JSON.stringify(body),
      modelId: "oracle",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    });

    if (request.task === "extract") {
      const r = this.byFile.get(text.replace(/^File: /, ""));
      if (!r) throw new Error(`Oracle has no receipt for "${text}".`);
      const f = (value: unknown) => ({ value, confidence: 0.95 });
      return respond({
        isReceipt: r.isReceipt,
        vendor: f(r.fields.vendor),
        date: f(r.fields.date),
        total: f(r.fields.total),
        currency: f(r.fields.currency),
        tax: f(r.fields.tax),
        summary: f(r.fields.summary),
      });
    }
    const [, vendor = "", items = ""] = /^Vendor: (.*)\nItems: (.*)\n/.exec(text) ?? [];
    const r = this.byVendor.get(`${vendor}\n${items}`);
    if (!r) throw new Error(`Oracle has no category for vendor "${vendor}".`);
    return respond({ category: r.category, confidence: 0.9, reason: "ground truth" });
  }
}

/** A flat rate on every day, so FX never fails under the oracle. */
export class FlatFxClient implements FxClient {
  constructor(private readonly audPerUnit = 1.44) {}

  async getRates(currency: string, from: string, to: string): Promise<FxRate[]> {
    const rates: FxRate[] = [];
    for (
      let d = Date.parse(`${from}T00:00:00Z`);
      d <= Date.parse(`${to}T00:00:00Z`);
      d += 86_400_000
    ) {
      rates.push({
        currency,
        date: new Date(d).toISOString().slice(0, 10),
        audPerUnit: this.audPerUnit,
        source: "flat test rate",
      });
    }
    return rates;
  }
}
