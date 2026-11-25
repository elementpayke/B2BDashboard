/** @vitest-environment jsdom */

import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  DASHBOARD_ROUTES,
  pathForScreen,
  screenForPath,
  screenForSegments,
} from "./dashboardRoutes";
import { useDashboardUrlSync } from "./useDashboardUrlSync";
import { DASHBOARD_NAV_ITEMS } from "./navConfig";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("dashboard route map", () => {
  it("gives every sidebar item a URL", () => {
    for (const item of DASHBOARD_NAV_ITEMS) {
      expect(pathForScreen(item.key), item.key).not.toBeNull();
    }
  });

  it("round-trips path ↔ screen, tolerating a trailing slash", () => {
    for (const [screen, path] of Object.entries(DASHBOARD_ROUTES)) {
      expect(screenForPath(path)).toBe(screen);
      expect(screenForPath(`${path}/`)).toBe(screen);
    }
  });

  it("maps catch-all segments and rejects unknown ones (→ 404)", () => {
    expect(screenForSegments(undefined)).toBe("home");
    expect(screenForSegments([])).toBe("home");
    expect(screenForSegments(["accounts"])).toBe("wallets");
    expect(screenForSegments(["developers"])).toBe("developer");
    expect(screenForSegments(["nope"])).toBeNull();
    expect(screenForSegments(["transactions", "extra"])).toBeNull();
  });

  it("stays server-safe — the server page calls it, so no \"use client\"", () => {
    const src = readFileSync(join(process.cwd(), "lib/navigation/dashboardRoutes.ts"), "utf8");
    expect(src).not.toMatch(/^["']use client["']/m);
  });

  it("does not route screens that need context", () => {
    expect(pathForScreen("accountDetail")).toBeNull();
    expect(pathForScreen("send")).toBeNull();
  });
});

describe("useDashboardUrlSync", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  let setScreen: (s: string) => void = () => {};
  function Harness({ initial, onNavigate }: { initial: string; onNavigate?: (s: string) => void }) {
    const [screen, set] = useState(initial);
    setScreen = set;
    useDashboardUrlSync(screen, (s) => {
      onNavigate?.(s);
      set(s);
    });
    return <p data-testid="screen">{screen}</p>;
  }

  it("pushes a history entry per screen change and keeps other query params", () => {
    window.history.replaceState(null, "", "/dashboard?theme=dark");
    const push = vi.spyOn(window.history, "pushState");
    render(<Harness initial="home" />);
    expect(push).not.toHaveBeenCalled();

    act(() => setScreen("transactions"));
    expect(window.location.pathname).toBe("/dashboard/transactions");
    expect(window.location.search).toBe("?theme=dark");
    expect(push).toHaveBeenCalledTimes(1);

    act(() => setScreen("accountDetail")); // not routable → URL unchanged
    expect(window.location.pathname).toBe("/dashboard/transactions");
    push.mockRestore();
  });

  it("normalises legacy ?screen= links with replaceState", () => {
    window.history.replaceState(null, "", "/dashboard?screen=reports");
    const push = vi.spyOn(window.history, "pushState");
    render(<Harness initial="reports" />);
    expect(window.location.pathname + window.location.search).toBe("/dashboard/reports");
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it("follows Back/Forward", () => {
    window.history.replaceState(null, "", "/dashboard/cards");
    const onNavigate = vi.fn();
    const { getByTestId } = render(<Harness initial="cards" onNavigate={onNavigate} />);
    act(() => {
      window.history.replaceState(null, "", "/dashboard/team");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(onNavigate).toHaveBeenCalledWith("team");
    expect(getByTestId("screen")).toHaveTextContent("team");
  });
});
