/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChoicePicker from "./ChoicePicker";

describe("ChoicePicker", () => {
  it("opens a list and reports the chosen value", () => {
    const onChange = vi.fn();
    render(
      <ChoicePicker
        id="bank"
        label="Bank"
        title="Choose bank"
        value="0"
        options={[
          { value: "0", label: "Access Bank" },
          { value: "1", label: "Ecobank Nigeria" },
          { value: "2", label: "Zenith Bank" },
        ]}
        onChange={onChange}
        searchable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /bank: access bank/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /ecobank/i }));
    expect(onChange).toHaveBeenCalledWith("1");
  });
});
