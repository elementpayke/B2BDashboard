// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import KybGateDialog, { gateActionLabel } from "./KybGateDialog";

function renderGate(status: string, extra: Partial<React.ComponentProps<typeof KybGateDialog>> = {}) {
  const props = {
    open: true,
    status,
    action: "send money",
    onStartVerification: vi.fn(),
    onViewStatus: vi.fn(),
    onClose: vi.fn(),
    ...extra,
  };
  render(<KybGateDialog {...props} />);
  return props;
}

describe("KybGateDialog", () => {
  it("says why the action is blocked and starts verification", () => {
    const p = renderGate("pending");
    expect(screen.getByRole("dialog", { name: "Verify your business to send money" })).toBeInTheDocument();
    expect(screen.getByText(/save and come back/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start verification" }));
    expect(p.onStartVerification).toHaveBeenCalled();
  });

  it("asks for fixes after a rejection", () => {
    const p = renderGate("rejected");
    expect(screen.getByRole("dialog", { name: "Verification needs a few fixes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fix and resubmit" }));
    expect(p.onStartVerification).toHaveBeenCalled();
  });

  it("starts again after expiry", () => {
    renderGate("expired");
    expect(screen.getByRole("button", { name: "Start again" })).toBeInTheDocument();
  });

  it("explains the wait while in review, without a start button", () => {
    const p = renderGate("submitted");
    expect(screen.getByRole("dialog", { name: "Your business is in review" })).toBeInTheDocument();
    expect(screen.getByText(/once compliance approves/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start|Fix/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View status" }));
    expect(p.onViewStatus).toHaveBeenCalled();
  });

  it("closes from Not now", () => {
    const p = renderGate("pending");
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it("names each gated action in plain words", () => {
    expect(gateActionLabel("send")).toBe("send money");
    expect(gateActionLabel("deposit")).toBe("add money");
    expect(gateActionLabel("receive")).toBe("get paid");
    expect(gateActionLabel("bulk")).toBe("send bulk payouts");
    expect(gateActionLabel("wallets")).toBe("open currency accounts");
    expect(gateActionLabel("something-new")).toBe("move money");
  });
});
