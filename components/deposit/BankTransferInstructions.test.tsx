// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const copyText = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/lib/clipboard", () => ({ copyText }));

import BankTransferInstructions from "./BankTransferInstructions";

const rows = [
  { k: "Amount", v: "5000 KES" },
  { k: "Account number", v: "0100234567" },
  { k: "Bank", v: "KCB" },
  { k: "Reference", v: "MBK-7Q4K2" },
  { k: "Expires", v: "14 Oct, 18:00" },
];

describe("BankTransferInstructions", () => {
  it("copies each value on its own and confirms it visibly", async () => {
    render(
      <BankTransferInstructions amount="5,000" currency="KES" rows={rows} arrival="Within 1 business day" onSent={vi.fn()} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy amount" }));
    });
    expect(copyText).toHaveBeenLastCalledWith("5000");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy reference" }));
    });
    expect(copyText).toHaveBeenLastCalledWith("MBK-7Q4K2");
    expect(screen.getByRole("button", { name: "reference copied" })).toHaveAttribute("data-copied", "true");
  });

  it("shows the pay-by deadline and copies everything in one go", async () => {
    render(
      <BankTransferInstructions amount="5,000" currency="KES" rows={rows} arrival="Within 1 business day" onSent={vi.fn()} />,
    );
    expect(screen.getByText("Pay before 14 Oct, 18:00")).toBeInTheDocument();
    // Amount/Reference/Expires are shown in their own blocks, not repeated in the list.
    expect(screen.queryByText("5000 KES")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy all" }));
    });
    const text = copyText.mock.calls.at(-1)?.[0] as string;
    expect(text.split("\n")[0]).toBe("Pay exactly 5,000 KES");
    expect(text).toContain("Reference: MBK-7Q4K2");
    expect(text).toContain("Arrival: Within 1 business day");
  });
});
