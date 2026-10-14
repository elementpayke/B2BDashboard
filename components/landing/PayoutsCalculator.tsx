"use client";
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/services/dashboard";
import { flagCdnUrl, PAYOUT_CORRIDORS, PAYOUT_FEE_PERCENT, PAYOUT_RATE_FALLBACK } from "./landingTokens";

/**
 * Payouts card's live rate calculator. Uses the same public
 * `/v1/exchange-rates` endpoint the logged-in dashboard reads (see
 * dashboardApi.exchangeRates) so the landing page never quotes a different
 * number than the app — per the design handoff's "same rate source as the
 * dashboard/app" requirement. Falls back to design-time values until the
 * first fetch resolves, and keeps the last good rates on failure.
 */

function formatRate(value: number): string {
  const dp = value < 100 ? 4 : 2;
  return value.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export default function PayoutsCalculator() {
  const [amount, setAmount] = useState("1000");
  const [selected, setSelected] = useState(0);

  const ratesQuery = useQuery({
    queryKey: ["landing-exchange-rates"],
    queryFn: dashboardApi.exchangeRates,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const rates = useMemo(() => {
    const live = ratesQuery.data?.rates;
    const merged: Record<string, number> = { ...PAYOUT_RATE_FALLBACK };
    if (live) {
      for (const { code } of PAYOUT_CORRIDORS) {
        const v = live[code];
        if (typeof v === "number" && Number.isFinite(v)) merged[code] = v;
      }
    }
    return merged;
  }, [ratesQuery.data]);

  const corridor = PAYOUT_CORRIDORS[selected];
  const amountNum = parseFloat(amount.replace(/,/g, "")) || 0;
  const rate = rates[corridor.code];
  const out = (amountNum * rate).toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          aria-label="Amount in USD"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "11px 13px",
            borderRadius: 12,
            border: "1.5px solid #E4E1EE",
            background: "#FAF9FD",
            fontFamily: "'DM Mono',monospace",
            fontSize: 13.5,
            color: "#131126",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <span
          style={{
            padding: "11px 13px",
            borderRadius: 12,
            background: "#F2F0FF",
            fontFamily: "'DM Mono',monospace",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          USD
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Destination currency">
        {PAYOUT_CORRIDORS.map((c, i) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setSelected(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 9px",
              borderRadius: 999,
              border: `1.5px solid ${i === selected ? "#3B2ED3" : "#E4E1EE"}`,
              background: "#FFFFFF",
              color: "#131126",
              cursor: "pointer",
            }}
            aria-pressed={i === selected}
          >
            <span
              style={{
                width: 16,
                height: 12,
                borderRadius: 2,
                backgroundImage: `url(${flagCdnUrl(c.iso)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              aria-hidden
            />
            <span style={{ fontSize: 11, fontWeight: 700 }}>{c.code}</span>
          </button>
        ))}
      </div>
      <div
        style={{
          background: "#3B2ED3",
          color: "#FFFFFF",
          borderRadius: 14,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
          {out} {corridor.code}
        </span>
        <span style={{ fontSize: 11, opacity: 0.75, fontFamily: "'DM Mono',monospace" }}>
          1 USD = {formatRate(rate)} {corridor.code} · Fee {PAYOUT_FEE_PERCENT}
        </span>
      </div>
    </div>
  );
}
