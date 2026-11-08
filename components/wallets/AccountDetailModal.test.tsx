// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openBrandedDocument } from "@/lib/documents/brandedDocument";
import AccountDetailModal, { formatSensitiveValue } from "./AccountDetailModal";

vi.mock("@/lib/documents/brandedDocument", () => ({
  openBrandedDocument: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("formatSensitiveValue", () => {
  it("groups a real IBAN and leaves short account numbers alone", () => {
    expect(formatSensitiveValue("IBAN", "FR7630006000011234567890189")).toBe(
      "FR76 3000 6000 0112 3456 7890 189",
    );
    expect(formatSensitiveValue("IBAN", "391881521473")).toBe("391881521473");
  });
});

describe("AccountDetailModal", () => {
  afterEach(() => {
    vi.mocked(openBrandedDocument).mockClear();
  });

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

  it("bank letter omits Settlement / Available balance", () => {
    render(
      <AccountDetailModal
        copiedField=""
        copyField={() => () => undefined}
        acctDetail={{
          currency: "USD",
          name: "US Dollar",
          beneficiary: "Elementpay LTD",
          showDownloadLetter: true,
          railLabel: "Account number · ACH / SWIFT",
          rows: [
            { label: "Account number", value: "391881521473" },
            { label: "Available balance", value: "12.00 USD" },
          ],
          sections: [
            {
              title: "Domestic transfer (ACH/wire)",
              rows: [
                { label: "Account number", value: "391881521473" },
                { label: "Routing number", value: "021214891" },
              ],
            },
            {
              title: "Settlement",
              rows: [{ label: "Available balance", value: "12.00 USD" }],
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Download bank letter/i }));

    expect(openBrandedDocument).toHaveBeenCalledOnce();
    const doc = vi.mocked(openBrandedDocument).mock.calls[0][0];
    expect(doc.sections.map((s) => s.title)).not.toContain("Settlement");
    expect(doc.sections.flatMap((s) => s.rows.map((r) => r.label))).not.toContain(
      "Available balance",
    );
  });

  it("bank letter also omits Mboka transfer / Mboka number", () => {
    render(
      <AccountDetailModal
        copiedField=""
        copyField={() => () => undefined}
        acctDetail={{
          currency: "EUR",
          name: "Euro",
          beneficiary: "Elementpay LTD",
          showDownloadLetter: true,
          railLabel: "IBAN",
          rows: [
            { label: "IBAN", value: "FR7630006000011234567890189" },
            { label: "Mboka number", value: "0017610033" },
          ],
          sections: [
            {
              title: "Domestic transfer",
              rows: [{ label: "Account number", value: "FR7630006000011234567890189" }],
            },
            {
              title: "Mboka transfer",
              rows: [{ label: "Mboka number", value: "0017610033" }],
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Download bank letter/i }));

    const doc = vi.mocked(openBrandedDocument).mock.calls[0][0];
    expect(doc.sections.map((s) => s.title)).not.toContain("Mboka transfer");
    expect(doc.sections.flatMap((s) => s.rows.map((r) => r.label))).not.toContain(
      "Mboka number",
    );
  });

  it("shows domestic and international rails as a tab switch, not stacked sections", () => {
    render(
      <AccountDetailModal
        copiedField=""
        copyField={() => () => undefined}
        acctDetail={{
          currency: "SEK",
          name: "Swedish Krona",
          beneficiary: "Elementpay LTD",
          rows: [
            { label: "Account number", value: "GB74GRFR04286206171089" },
            { label: "SWIFT/BIC", value: "GRFRGB22XXX" },
          ],
          sections: [
            {
              title: "Domestic transfer",
              rows: [
                { label: "Account number", value: "GB74GRFR04286206171089", copyValue: "GB74GRFR04286206171089" },
                { label: "Bank", value: "Global Remit Financial Services Ltd" },
              ],
            },
            {
              title: "International wire",
              rows: [
                { label: "SWIFT/BIC", value: "GRFRGB22XXX", copyValue: "GRFRGB22XXX" },
                { label: "IBAN", value: "GB74GRFR04286206171089", copyValue: "GB74GRFR04286206171089" },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("tab", { name: "Domestic transfer" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "International wire" })).toBeTruthy();

    // Domestic is active by default — its rows show, international's don't.
    expect(screen.getByText("Global Remit Financial Services Ltd")).toBeTruthy();
    expect(screen.queryByText("GB74 GRFR 0428 6206 1710 89")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "International wire" }));

    expect(screen.queryByText("Global Remit Financial Services Ltd")).toBeNull();
    expect(screen.getByText("GB74 GRFR 0428 6206 1710 89")).toBeTruthy();
  });

  it("folds a separate Bank details section into whichever rail tab is active, with no extra header", () => {
    render(
      <AccountDetailModal
        copiedField=""
        copyField={() => () => undefined}
        acctDetail={{
          currency: "EUR",
          name: "Euro",
          rows: [{ label: "IBAN", value: "FR7630006000011234567890189" }],
          sections: [
            {
              title: "Domestic transfer",
              rows: [
                { label: "Account number", value: "FR7630006000011234567890189", copyValue: "FR7630006000011234567890189" },
              ],
            },
            {
              title: "International wire",
              rows: [
                { label: "SWIFT/BIC", value: "MODRFR21", copyValue: "MODRFR21" },
              ],
            },
            {
              title: "Bank details",
              rows: [{ label: "Bank", value: "SOCIETE GENERALE", copyValue: "SOCIETE GENERALE" }],
            },
          ],
        }}
      />,
    );

    // No standalone "BANK DETAILS" section header — it rides along in the tab.
    expect(screen.queryByText("Bank details")).toBeNull();
    expect(screen.getByText("SOCIETE GENERALE")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "International wire" }));
    expect(screen.getByText("SOCIETE GENERALE")).toBeTruthy();
  });

  it("shows no Refresh details button without both an accountId and an onRefreshAccount handler", () => {
    render(
      <AccountDetailModal
        copiedField=""
        copyField={() => () => undefined}
        acctDetail={{
          currency: "USD",
          name: "US Dollar",
          status: "active",
          rows: [{ label: "IBAN", value: "391881521473" }],
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /Refresh details/i })).toBeNull();
  });

  it("shows no Refresh details button for a non-active account even with a handler", () => {
    renderWithClient(
      <AccountDetailModal
        copiedField=""
        copyField={() => () => undefined}
        acctDetail={{
          currency: "USD",
          name: "US Dollar",
          status: "pending",
          accountId: "acc_1",
          rows: [{ label: "IBAN", value: "391881521473" }],
        }}
        onRefreshAccount={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Refresh details/i })).toBeNull();
  });

  it("calls onRefreshAccount with the account id, shows a busy label, then recovers", async () => {
    let resolveRefresh: () => void = () => undefined;
    const onRefreshAccount = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    renderWithClient(
      <AccountDetailModal
        copiedField=""
        copyField={() => () => undefined}
        acctDetail={{
          currency: "USD",
          name: "US Dollar",
          status: "active",
          accountId: "acc_1",
          rows: [{ label: "IBAN", value: "391881521473" }],
        }}
        onRefreshAccount={onRefreshAccount}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh details" }));
    expect(onRefreshAccount).toHaveBeenCalledWith("acc_1");
    expect(screen.getByRole("button", { name: "Refreshing…" })).toBeTruthy();

    resolveRefresh();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Refresh details" })).toBeTruthy(),
    );
  });

  it("shows an error message when onRefreshAccount rejects", async () => {
    const onRefreshAccount = vi.fn().mockRejectedValue(new Error("Sync failed"));
    renderWithClient(
      <AccountDetailModal
        copiedField=""
        copyField={() => () => undefined}
        acctDetail={{
          currency: "USD",
          name: "US Dollar",
          status: "active",
          accountId: "acc_1",
          rows: [{ label: "IBAN", value: "391881521473" }],
        }}
        onRefreshAccount={onRefreshAccount}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh details" }));
    await waitFor(() => expect(screen.getByText("Sync failed")).toBeTruthy());
  });
});
