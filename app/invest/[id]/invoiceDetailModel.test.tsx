/**
 * @jest-environment jsdom
 *
 * @file invoiceDetailModel.test.tsx
 *
 * Unit tests for the pure invoice-detail derivation helpers.
 */

import {
  formatYield,
  sanitizeText,
  buildInvoiceJsonLd,
  deriveInvoiceDetailFields,
  deriveInvoiceDetailViewModel,
} from "./invoiceDetailModel";
import { copy } from "@/app/copy/en";
import { INVALID_VALUE_FALLBACK } from "@/lib/format/currency";

const detail = copy.invest.detail;

const MOCK_INVOICE = {
  id: "inv-001",
  issuer: "Acme Supplies Ltd",
  amount: "12,500",
  amountValue: 12500,
  currency: "USD",
  dueDate: "2026-06-15",
  yield: "8.2",
  yieldValue: 8.2,
  status: "Open",
  timestamps: { uploaded: "2025-01-10" },
};

describe("formatYield", () => {
  it("appends a percent sign for resolvable amounts", () => {
    expect(formatYield("8.2")).toMatch(/%$/);
  });

  it("returns the invalid fallback for unresolvable values", () => {
    expect(formatYield(null)).toBe(INVALID_VALUE_FALLBACK);
  });
});

describe("sanitizeText", () => {
  it("strips characters that could break JSON-LD script context", () => {
    expect(sanitizeText(`Acme <script>"x"`)).toBe("Acme scriptx");
  });

  it("returns empty string for nullish input", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
  });
});

describe("buildInvoiceJsonLd", () => {
  it("returns null when invoice is absent", () => {
    expect(buildInvoiceJsonLd(null)).toBeNull();
  });

  it("builds an Offer with sanitized fields", () => {
    const jsonLd = buildInvoiceJsonLd(MOCK_INVOICE);
    expect(jsonLd).toMatchObject({
      "@type": "Offer",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    });
  });
});

describe("deriveInvoiceDetailFields", () => {
  it("returns an empty array when invoice is missing", () => {
    expect(deriveInvoiceDetailFields(null)).toEqual([]);
    expect(deriveInvoiceDetailFields(undefined)).toEqual([]);
  });

  it("returns five ordered field descriptors", () => {
    const fields = deriveInvoiceDetailFields(MOCK_INVOICE);
    expect(fields).toHaveLength(5);
    expect(fields.map((f) => f.key)).toEqual(["issuer", "amount", "yield", "maturity", "status"]);
    expect(fields[0].label).toBe(detail.labelIssuer);
    expect(fields[4].kind).toBe("status");
    expect(fields[4].value).toBe("Open");
  });

  it("scales to a large data set of invoices without throwing", () => {
    const many = Array.from({ length: 500 }, (_, i) => ({
      ...MOCK_INVOICE,
      id: `inv-${i}`,
      issuer: `Issuer ${i}`,
    }));
    const allFields = many.map((inv) => deriveInvoiceDetailFields(inv));
    expect(allFields).toHaveLength(500);
    expect(allFields[499]).toHaveLength(5);
    expect(allFields[499][0].value).toBe("Issuer 499");
  });

  it("updates field values when the filter/status input changes", () => {
    const openFields = deriveInvoiceDetailFields(MOCK_INVOICE);
    const fundedFields = deriveInvoiceDetailFields({
      ...MOCK_INVOICE,
      status: "Funded",
    });
    expect(openFields[4].value).toBe("Open");
    expect(fundedFields[4].value).toBe("Funded");
  });
});

describe("deriveInvoiceDetailViewModel", () => {
  it("bundles fields, jsonLd, and action props", () => {
    const vm = deriveInvoiceDetailViewModel(MOCK_INVOICE);
    expect(vm.fields).toHaveLength(5);
    expect(vm.jsonLd?.["@type"]).toBe("Offer");
    expect(vm.id).toBe("inv-001");
    expect(vm.maxAmount).toBe(12500);
    expect(vm.yieldValue).toBe(8.2);
    expect(vm.timestamps).toEqual({ uploaded: "2025-01-10" });
  });
});
