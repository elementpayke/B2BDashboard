// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccountActivityList from "./AccountActivityList";
import { accountActivityApi } from "@/lib/services/accountActivity";

vi.mock("@/lib/services/accountActivity", () => ({
  accountActivityApi: { listPage: vi.fn() },
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = makeClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("AccountActivityList", () => {
  afterEach(() => {
    vi.mocked(accountActivityApi.listPage).mockReset();
  });

  it("renders nothing when there is no account id — never calls the API", () => {
    const { container } = renderWithClient(<AccountActivityList accountId={null} />);
    expect(container.firstChild).toBeNull();
    expect(accountActivityApi.listPage).not.toHaveBeenCalled();
  });

  it("shows entries once the backend returns them", async () => {
    vi.mocked(accountActivityApi.listPage).mockResolvedValue({
      entries: [
        {
          event_type: "account_opened",
          label: "Account opened",
          occurred_at: "2026-09-01T10:00:00Z",
          detail: null,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    });
    renderWithClient(<AccountActivityList accountId="acc_123" />);
    await waitFor(() => expect(screen.getByText("Account opened")).toBeTruthy());
    expect(accountActivityApi.listPage).toHaveBeenCalledWith("acc_123", {
      limit: 10,
      offset: 0,
    });
  });

  it("shows a quiet empty state rather than nothing when the backend returns zero entries", async () => {
    vi.mocked(accountActivityApi.listPage).mockResolvedValue({
      entries: [],
      total: 0,
      limit: 10,
      offset: 0,
    });
    renderWithClient(<AccountActivityList accountId="acc_123" />);
    await waitFor(() => expect(screen.getByText("No activity yet.")).toBeTruthy());
  });

  it("degrades to nothing on error rather than showing a scary banner", async () => {
    vi.mocked(accountActivityApi.listPage).mockRejectedValue(new Error("404"));
    const { container } = renderWithClient(<AccountActivityList accountId="acc_123" />);
    await waitFor(() => expect(container.querySelector(".ep-wallets-detail__section")).toBeNull());
  });
});
