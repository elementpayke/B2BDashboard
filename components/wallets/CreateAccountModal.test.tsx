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

  it("does not show a disclosure for a currency with no fee, even when others have one", () => {
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
    expect(screen.queryByText(/maintenance fee/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).not.toBeDisabled();
  });
});
