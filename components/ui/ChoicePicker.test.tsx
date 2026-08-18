/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChoicePicker from "./ChoicePicker";

const OPTIONS = [
  { value: "0", label: "Access Bank" },
  { value: "1", label: "Ecobank Nigeria" },
  { value: "2", label: "Zenith Bank" },
];

function setViewport(width: number, height = 800) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}

afterEach(() => {
  setViewport(1280, 800);
});

describe("ChoicePicker", () => {
  it("opens a list and reports the chosen value", async () => {
    setViewport(1280);
    const onChange = vi.fn();
    render(
      <ChoicePicker
        id="bank"
        label="Bank"
        title="Choose bank"
        value="0"
        options={OPTIONS}
        onChange={onChange}
        searchable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /bank: access bank/i }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /ecobank/i }));
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("opens a compact sheet below the desktop breakpoint", async () => {
    setViewport(390);
    render(
      <ChoicePicker
        id="bank"
        label="Bank"
        title="Choose bank"
        value="0"
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    fireEvent.click(screen.getByRole("button", { name: /bank: access bank/i }));
    expect(await screen.findByRole("dialog", { name: /choose bank/i })).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("filters options from the search field", async () => {
    setViewport(1280);
    render(
      <ChoicePicker
        id="bank"
        label="Bank"
        title="Choose bank"
        value="0"
        options={OPTIONS}
        onChange={vi.fn()}
        searchable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /bank: access bank/i }));
    const search = await screen.findByRole("textbox", { name: /search/i });
    fireEvent.change(search, { target: { value: "zenith" } });
    expect(screen.getByRole("option", { name: /zenith/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /access/i })).not.toBeInTheDocument();
  });

  it("closes on Escape and restores trigger focus", async () => {
    setViewport(1280);
    render(
      <ChoicePicker
        id="bank"
        label="Bank"
        title="Choose bank"
        value="0"
        options={OPTIONS}
        onChange={vi.fn()}
        searchable={false}
      />,
    );

    const trigger = screen.getByRole("button", { name: /bank: access bank/i });
    fireEvent.click(trigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("moves highlight with arrows when search is hidden", async () => {
    setViewport(1280);
    const onChange = vi.fn();
    render(
      <ChoicePicker
        id="bank"
        label="Bank"
        title="Choose bank"
        value="0"
        options={OPTIONS}
        onChange={onChange}
        searchable={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /bank: access bank/i }));
    const listbox = await screen.findByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("flips the desktop popover above the trigger when space below is tight", async () => {
    setViewport(1280, 600);
    render(
      <ChoicePicker
        id="bank"
        label="Bank"
        title="Choose bank"
        value="0"
        options={OPTIONS}
        onChange={vi.fn()}
        searchable={false}
      />,
    );

    const trigger = screen.getByRole("button", { name: /bank: access bank/i });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      x: 24,
      y: 500,
      top: 500,
      bottom: 544,
      left: 24,
      right: 264,
      width: 240,
      height: 44,
      toJSON() {
        return {};
      },
    });

    fireEvent.click(trigger);
    const listbox = await screen.findByRole("listbox");
    await waitFor(() => {
      expect(listbox.style.bottom).not.toBe("");
      expect(listbox.style.top).toBe("auto");
    });
  });
});
