// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateAccountModal, { type CreateAccountModalProps } from "./CreateAccountModal";

function baseProps(overrides: Partial<CreateAccountModalProps> = {}): CreateAccountModalProps {
  return {
    createAccountName: "",
    setCreateAccountName: vi.fn(),
    createAccountKind: "bank",
    createAccountCurrency: "",
    setCreateAccountCurrency: vi.fn(),
    createAccountStablecoin: "",
    setCreateAccountStablecoin: vi.fn(),
    createAccountNetwork: "",
    setCreateAccountNetwork: vi.fn(),
    createAccountError: "",
    createAccountSaving: false,
    closeModal: vi.fn(),
    submitCreateAccount: vi.fn(),
    ...overrides,
  };
}

/**
 * The notice emphasises the amount in its own <strong>, so the sentence spans
 * several nodes. Assert against the panel's flattened text rather than a
 * single-element matcher, which breaks at the element boundary.
 */
function feeNoticeText(): string {
  const panel = document.querySelector(".ep-wallets-create__kind");
  return (panel?.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("CreateAccountModal — monthly maintenance fee disclosure", () => {
  it("shows no fee disclosure when the backend hasn't shipped supportedAccounts yet", () => {
    render(<CreateAccountModal {...baseProps({ createAccountCurrency: "USD" })} />);
    expect(screen.queryByText(/maintenance fee/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).not.toBeDisabled();
  });

  it("shows a disclosure and requires acknowledgment before submit when the selected currency has a fee", () => {
    render(
      <CreateAccountModal
        {...baseProps({
          createAccountCurrency: "GBP",
          supportedAccounts: [
            {
              currency: "GBP",
              rail_type: "local_bank",
              fields: ["account_number", "sort_code"],
              monthly_maintenance_fee: { amount: "5.00", currency: "USD" },
            },
          ],
        })}
      />,
    );
    expect(screen.getAllByText(/5\.00 USD\/month/).length).toBeGreaterThan(0);
    const submitButton = screen.getByRole("button", { name: "Create account" });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submitButton).not.toBeDisabled();
  });

  it("says the fee is unpublished — not silence — for a currency the schedule omits", () => {
    render(
      <CreateAccountModal
        {...baseProps({
          createAccountCurrency: "USD",
          supportedAccounts: [
            { currency: "USD", rail_type: "ach_wire", fields: ["account_number"] },
            {
              currency: "GBP",
              rail_type: "local_bank",
              fields: ["sort_code"],
              monthly_maintenance_fee: { amount: "5.00", currency: "USD" },
            },
          ],
        })}
      />,
    );
    // An omitted figure is "we were not told", not "it is free" — the copy must
    // not let the reader infer the latter, and there is nothing to consent to.
    expect(
      screen.getByText(/don't have a published monthly fee for USD/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).not.toBeDisabled();
  });

  it("states a published zero as free, and does not gate submit on acknowledging it", () => {
    render(
      <CreateAccountModal
        {...baseProps({
          createAccountCurrency: "GBP",
          supportedAccounts: [
            {
              currency: "GBP",
              rail_type: "local_bank",
              fields: ["sort_code"],
              monthly_maintenance_fee: { amount: "0.00", currency: "GBP" },
            },
          ],
        })}
      />,
    );
    expect(feeNoticeText()).toMatch(/no monthly fee on this GBP account/i);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).not.toBeDisabled();
  });

  it("discloses a stablecoin account's fee too, and gates submit on it", () => {
    render(
      <CreateAccountModal
        {...baseProps({
          createAccountKind: "stablecoin",
          createAccountStablecoin: "USDC",
          createAccountNetwork: "BASE",
          supportedAccounts: [
            {
              currency: "USDC",
              rail_type: "stablecoin",
              fields: ["network"],
              monthly_maintenance_fee: { amount: "2.00", currency: "USD" },
            },
          ],
        })}
      />,
    );
    expect(feeNoticeText()).toMatch(/monthly maintenance fee of USD 2\.00 will apply/i);
    const submit = screen.getByRole("button", { name: "Create account" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).not.toBeDisabled();
  });

  it("looks the stablecoin fee up by asset, not by the unused fiat currency field", () => {
    render(
      <CreateAccountModal
        {...baseProps({
          createAccountKind: "stablecoin",
          createAccountStablecoin: "USDT",
          createAccountNetwork: "POLYGON",
          // A stale fiat selection must not pull in the USD fee.
          createAccountCurrency: "USD",
          supportedAccounts: [
            {
              currency: "USD",
              rail_type: "ach_wire",
              fields: ["account_number"],
              monthly_maintenance_fee: { amount: "5.00", currency: "USD" },
            },
            { currency: "USDT", rail_type: "stablecoin", fields: ["network"] },
          ],
        })}
      />,
    );
    expect(screen.queryByText(/maintenance fee/i)).toBeNull();
  });
});
