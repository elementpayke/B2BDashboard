// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CardColorPicker from "./CardColorPicker";

describe("CardColorPicker", () => {
  it("renders all twelve palette colours as round radio swatches", () => {
    render(<CardColorPicker value="mint" onChange={vi.fn()} />);
    const swatches = screen.getAllByRole("radio");
    expect(swatches).toHaveLength(12);
    expect(screen.getByRole("radio", { name: "Mint" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Mint" }).style.background).toMatch(/94, 214, 180|#5ed6b4/i);
  });

  it("has a single tab stop on the selected colour", () => {
    render(<CardColorPicker value="coral" onChange={vi.fn()} />);
    const tabbable = screen.getAllByRole("radio").filter((r) => r.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName("Coral");
  });

  it("selects on click", () => {
    const onChange = vi.fn();
    render(<CardColorPicker value="indigo" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Plum" }));
    expect(onChange).toHaveBeenCalledWith("plum");
  });

  it("moves and selects with arrow keys, wrapping at the ends", () => {
    const onChange = vi.fn();
    const { rerender } = render(<CardColorPicker value="indigo" onChange={onChange} />);
    const group = screen.getByRole("radiogroup", { name: "Card colour" });
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("marigold");
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("plum");
    rerender(<CardColorPicker value="plum" onChange={onChange} />);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("indigo");
  });

  it("ignores input while disabled", () => {
    const onChange = vi.fn();
    render(<CardColorPicker value="indigo" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("radio", { name: "Plum" }));
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
