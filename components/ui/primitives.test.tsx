/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Field } from "./Field";
import { Input } from "./Input";
import { Amount, formatAmount } from "./Amount";
import { Badge } from "./Badge";
import { Dialog, DialogContent } from "./Dialog";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

afterEach(cleanup);

describe("cn", () => {
  it("keeps a custom font size and a colour together (custom scale registered)", () => {
    expect(cn("text-sm text-primary")).toBe("text-sm text-primary");
  });
  it("lets later classes override earlier ones", () => {
    expect(cn("h-11 px-4", "px-6")).toBe("h-11 px-6");
  });
});

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "button");
  });

  it("blocks clicks and announces busy while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Confirm
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Confirm" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders the child element with asChild", () => {
    render(
      <Button asChild variant="link">
        <a href="https://mboka.finance/help">Help centre</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Help centre" });
    expect(link).toHaveAttribute("href", "https://mboka.finance/help");
    expect(link).not.toHaveAttribute("type");
  });
});

describe("Field", () => {
  it("links label, hint and control", () => {
    render(
      <Field label="Account name" hint="As shown on the bank statement">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Account name");
    expect(input).toHaveAccessibleDescription("As shown on the bank statement");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the control invalid and announces the error instead of the hint", () => {
    render(
      <Field label="Amount" hint="Min 1.00" error="Enter at least 1.00">
        <Input mono />
      </Field>,
    );
    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter at least 1.00");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter at least 1.00");
    expect(screen.queryByText("Min 1.00")).toBeNull();
  });

  it("supports a render function for custom controls", () => {
    render(<Field label="Note">{(p) => <textarea {...p} />}</Field>);
    expect(screen.getByLabelText("Note").tagName).toBe("TEXTAREA");
  });
});

describe("Amount", () => {
  it("formats with grouping and two decimals, keeping string precision", () => {
    expect(formatAmount("2481300")).toBe("2,481,300.00");
    expect(formatAmount(-12.5)).toBe("12.50");
    expect(formatAmount("not-a-number")).toBeNull();
  });

  it("signs inbound and outbound amounts", () => {
    const { container, rerender } = render(<Amount value="150" currency="USDC" direction="in" />);
    expect(container.textContent).toBe("+150.00USDC");
    rerender(<Amount value="150" currency="KES" direction="out" />);
    expect(container.textContent).toBe("−150.00KES");
  });

  it("renders a dash, not 0.00, when the value is missing", () => {
    render(<Amount value={null} currency="USD" />);
    expect(screen.getByLabelText("Amount unavailable")).toHaveTextContent("—");
  });
});

describe("Badge", () => {
  it("shows a dot so status is not colour-only", () => {
    const { container } = render(<Badge tone="success">Settled</Badge>);
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
    expect(screen.getByText("Settled")).toBeInTheDocument();
  });
});

describe("Dialog", () => {
  it("renders an accessible, titled dialog that closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent title="Close account" description="This cannot be undone.">
          body
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Close account" });
    expect(dialog).toHaveAccessibleDescription("This cannot be undone.");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("EmptyState", () => {
  it("announces error states", () => {
    render(<EmptyState tone="error" title="Couldn't load transactions" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load transactions");
  });
});
