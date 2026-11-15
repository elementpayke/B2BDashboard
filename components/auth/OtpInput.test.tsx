// @vitest-environment jsdom

import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OtpInput from "./OtpInput";

/** Controlled wrapper, since the real usage drives value from form state. */
function Harness({
  onComplete,
  initial = "",
}: {
  onComplete?: (code: string) => void;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <OtpInput label="6-digit code" value={value} onChange={setValue} onComplete={onComplete} />
  );
}

const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];

describe("OtpInput", () => {
  it("renders one box per digit, grouped under a single label", () => {
    render(<Harness />);
    expect(boxes()).toHaveLength(6);
    expect(screen.getByRole("group", { name: "6-digit code" })).toBeInTheDocument();
  });

  it("advances as digits are typed", () => {
    render(<Harness />);
    const b = boxes();
    fireEvent.change(b[0], { target: { value: "1" } });
    fireEvent.change(b[1], { target: { value: "2" } });
    expect(b[0].value).toBe("1");
    expect(b[1].value).toBe("2");
  });

  it("ignores non-numeric input", () => {
    render(<Harness />);
    fireEvent.change(boxes()[0], { target: { value: "a" } });
    expect(boxes()[0].value).toBe("");
  });

  it("spreads a pasted code across every box", () => {
    render(<Harness />);
    fireEvent.paste(boxes()[0], {
      clipboardData: { getData: () => "123456" },
    });
    expect(boxes().map((i) => i.value).join("")).toBe("123456");
  });

  it("tolerates the spaced formatting authenticator apps display", () => {
    render(<Harness />);
    fireEvent.paste(boxes()[0], {
      clipboardData: { getData: () => "123 456" },
    });
    // Dropping the space must not truncate the code to three digits.
    expect(boxes().map((i) => i.value).join("")).toBe("123456");
  });

  it("clears the current digit on Backspace, then steps back when empty", () => {
    render(<Harness initial="12" />);
    const b = boxes();
    fireEvent.keyDown(b[1], { key: "Backspace" });
    expect(boxes()[1].value).toBe("");
    fireEvent.keyDown(boxes()[1], { key: "Backspace" });
    expect(boxes()[0].value).toBe("");
  });

  it("fires onComplete once the final digit lands, so the form can self-submit", () => {
    const onComplete = vi.fn();
    render(<Harness initial="12345" onComplete={onComplete} />);
    fireEvent.change(boxes()[5], { target: { value: "6" } });
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("does not fire onComplete while the code is short", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(boxes()[0], { target: { value: "1" } });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("marks every box invalid so the error reads as one field, not six", () => {
    render(
      <OtpInput label="6-digit code" value="123456" onChange={() => {}} invalid />,
    );
    expect(boxes().every((i) => i.getAttribute("aria-invalid") === "true")).toBe(true);
  });

  it("exposes a single one-time-code target for autofill", () => {
    render(<Harness />);
    const otc = boxes().filter((i) => i.getAttribute("autocomplete") === "one-time-code");
    // More than one and some password managers fill only the first box.
    expect(otc).toHaveLength(1);
  });
});
