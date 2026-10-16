// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CloseAccountModal from "./CloseAccountModal";

describe("CloseAccountModal", () => {
  it("confirms closing the account", async () => {
    const onContinue = vi.fn().mockResolvedValue(undefined);
    render(
      <CloseAccountModal
        accountName="USDC · Stellar"
        currency="USDC"
        networkLabel="Stellar"
        onCancel={vi.fn()}
        onContinue={onContinue}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close account" }));
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
  });

  it("disables the confirm button when the wallet is already closed", () => {
    render(
      <CloseAccountModal
        accountName="USDC · Stellar"
        currency="USDC"
        networkLabel="Stellar"
        alreadyClosed
        onCancel={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Close account" })).toBeDisabled();
    expect(screen.getByText(/already closed/i)).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <CloseAccountModal
        accountName="USDC · Stellar"
        currency="USDC"
        networkLabel="Stellar"
        onCancel={onCancel}
        onContinue={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
