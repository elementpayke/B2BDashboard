// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AccountDetailModal, { formatSensitiveValue } from "./AccountDetailModal";

describe("formatSensitiveValue", () => {
  it("groups a real IBAN and leaves short account numbers alone", () => {
    expect(formatSensitiveValue("IBAN", "FR7630006000011234567890189")).toBe(
      "FR76 3000 6000 0112 3456 7890 189",
    );
    expect(formatSensitiveValue("IBAN", "391881521473")).toBe("391881521473");
  });
});

describe("AccountDetailModal", () => {
  it("renders API beneficiary and bank rows horizontally with copy", () => {
    const copyField = vi.fn(() => vi.fn());
    render(
      <AccountDetailModal
        copiedField=""
        copyField={copyField}
        acctDetail={{
          currency: "USD",
          name: "US Dollar",
          beneficiary: "Elementpay LTD",
          rows: [
            { label: "IBAN", value: "391881521473", copyValue: "391881521473" },
            { label: "BIC / SWIFT", value: "021214891", copyValue: "021214891" },
            { label: "Bank", value: "CROSS RIVER BANK", copyValue: "CROSS RIVER BANK" },
            { label: "Account name", value: "Elementpay LTD", copyValue: "Elementpay LTD" },
          ],
        }}
      />,
    );

    expect(screen.getByText("Elementpay LTD")).toBeTruthy();
    expect(screen.queryByText("US Dollar")).toBeNull();
    expect(screen.getByText("CROSS RIVER BANK")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Copy /i }).length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole("button", { name: "Copy Name" }));
    expect(copyField).toHaveBeenCalled();
  });

  it("hides the beneficiary block when the API did not return a holder name", () => {
    render(
      <AccountDetailModal
        copiedField=""
        copyField={() => () => undefined}
        acctDetail={{
          currency: "EUR",
          name: "Euro",
          beneficiary: null,
          rows: [{ label: "IBAN", value: "FR7630006000011234567890189" }],
        }}
      />,
    );
    expect(screen.queryByText("Beneficiary")).toBeNull();
    expect(screen.queryByText("Euro")).toBeNull();
    expect(screen.getByText("FR76 3000 6000 0112 3456 7890 189")).toBeTruthy();
  });
});
