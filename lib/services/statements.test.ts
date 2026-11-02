import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", () => ({
  apiEnvelope: vi.fn(),
  apiDownloadBlob: vi.fn(),
  ApiRequestError: class ApiRequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { apiDownloadBlob, apiEnvelope } from "@/lib/apiClient";
import { statementsApi } from "./statements";

describe("statementsApi", () => {
  beforeEach(() => {
    vi.mocked(apiEnvelope).mockReset();
    vi.mocked(apiDownloadBlob).mockReset();
  });

  it("normalizes list rows and AVAILABLE/MTD badges", async () => {
    vi.mocked(apiEnvelope).mockResolvedValue({
      accounts: [{ entity_id: "e1", account_id: "a1", name: "Stellar USDC", currency: "usdc" }],
      rows: [
        {
          period_key: "2026-10",
          period_label: "October 2026",
          year: 2026,
          month: 10,
          entity_id: "e1",
          account_id: "a1",
          account_name: "Stellar USDC",
          currency: "USDC",
          status: ["AVAILABLE", "MTD"],
          line_count: 2,
        },
      ],
    } as never);

    const list = await statementsApi.list();
    expect(apiEnvelope).toHaveBeenCalledWith("GET", "/v1/statements");
    expect(list.accounts[0].currency).toBe("USDC");
    expect(list.rows[0].status).toEqual(["AVAILABLE", "MTD"]);
  });

  function stubDomDownload() {
    const click = vi.fn();
    const anchor = {
      click,
      remove: vi.fn(),
      href: "",
      download: "",
    };
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn((node: unknown) => node) },
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("window", { setTimeout: vi.fn((fn: () => void) => fn()) });
    return click;
  }

  it("requests pdf download path", async () => {
    const click = stubDomDownload();
    vi.mocked(apiDownloadBlob).mockResolvedValue({
      blob: new Blob(["%PDF"], { type: "application/pdf" }),
      filename: "statement.pdf",
    });

    await statementsApi.download({
      entityId: "e1",
      accountId: "a1",
      periodKey: "2026-07",
      format: "pdf",
    });

    expect(apiDownloadBlob).toHaveBeenCalledWith(
      "/v1/statements/e1/a1/2026-07?format=pdf",
    );
    expect(click).toHaveBeenCalled();
  });

  it("requests range export path", async () => {
    const click = stubDomDownload();
    vi.mocked(apiDownloadBlob).mockResolvedValue({
      blob: new Blob(["date,amount"], { type: "text/csv" }),
      filename: "statement.csv",
    });

    await statementsApi.downloadRange({
      entityId: "e1",
      accountId: "a1",
      from: "2026-01",
      to: "2026-03",
      format: "csv",
    });

    expect(apiDownloadBlob).toHaveBeenCalledWith(
      "/v1/statements/e1/a1/export?from=2026-01&to=2026-03&format=csv",
    );
    expect(click).toHaveBeenCalled();
  });
});
