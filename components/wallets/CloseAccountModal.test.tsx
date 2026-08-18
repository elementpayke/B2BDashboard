// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CloseAccountModal from "./CloseAccountModal";

describe("CloseAccountModal", () => {
  it("defaults to Block wallet and continues with that action", async () => {
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

    expect(screen.getByRole("radio", { name: /Block wallet/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith("block"));
  });

  it("lets the user pick Delete wallet before Continue", async () => {
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

    fireEvent.click(screen.getByRole("radio", { name: /Delete wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith("delete"));
  });

  it("disables Block when the wallet is already closed", () => {
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

    expect(screen.getByRole("radio", { name: /Block wallet/i })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Delete wallet/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
