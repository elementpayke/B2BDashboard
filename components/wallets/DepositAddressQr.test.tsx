// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import DepositAddressQr from "./DepositAddressQr";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
  },
}));

describe("DepositAddressQr", () => {
  it("renders a QR image for the deposit address", async () => {
    render(
      <DepositAddressQr
        address="GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE"
        currency="USDC"
        network="Stellar"
        networkLabel="Stellar"
        amount="10"
      />,
    );
    const img = await waitFor(() =>
      screen.getByRole("img", { name: /QR code for USDC on Stellar/i }),
    );
    expect(img).toHaveAttribute("src", "data:image/png;base64,qr");
    const payload = vi.mocked(QRCode.toDataURL).mock.calls[0][0] as string;
    expect(payload).toContain("web+stellar:pay?");
    expect(payload).toContain("destination=GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE");
    expect(payload).toContain("amount=10");
    expect(screen.getByText("Scan with a Stellar wallet")).toBeInTheDocument();
  });
});
