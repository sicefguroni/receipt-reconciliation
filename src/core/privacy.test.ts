import { describe, expect, it } from "vitest";
import { maskCardNumbers } from "./privacy";

describe("card number masking (04, privacy)", () => {
  it("masks a 16-digit card number to its last 4 digits, grouped or not", () => {
    expect(maskCardNumbers("Paid with 4111 1111 1111 4821")).toBe("Paid with •••• 4821");
    expect(maskCardNumbers("card 4111-1111-1111-4821")).toBe("card •••• 4821");
    expect(maskCardNumbers("4111111111114821")).toBe("•••• 4821");
  });

  it("leaves short numbers alone: amounts, invoice numbers, phone numbers", () => {
    const text = "Invoice INV-20481, total 312.00, call 800-555-0100";
    expect(maskCardNumbers(text)).toBe(text);
  });
});
