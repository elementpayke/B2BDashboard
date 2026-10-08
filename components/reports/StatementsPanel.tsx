"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/apiClient";
import {
  statementsApi,
  type StatementPeriodRow,
} from "@/lib/services/statements";

function currencyGlyph(currency: string, network?: string | null): string {
  const c = (currency || "").toUpperCase();
  const n = (network || "").toLowerCase();
  if (c === "USDC" || c === "USDT" || c === "EURC") {
    if (n.includes("stellar")) return "✦";
    if (n.includes("polygon")) return "⬡";
    return "$";
  }
  if (c === "CAD") return "🇨🇦";
  if (c === "NOK") return "🇳🇴";
  if (c === "SEK") return "🇸🇪";
  if (c === "CNY" || c === "CNH") return "🇨🇳";
  return c.slice(0, 1) || "·";
}

function DownloadMenu({
  row,
  onDownloaded,
}: {
  row: StatementPeriodRow;
  onDownloaded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const download = async (format: "pdf" | "csv") => {
    setBusy(format);
    setError("");
    try {
      await statementsApi.download({
        entityId: row.entity_id,
        accountId: row.account_id,
        periodKey: row.period_key,
        format,
      });
      setOpen(false);
      onDownloaded?.();
    } catch (err) {
      setError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Download failed.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ep-statements__dl" ref={rootRef}>
      <button
        type="button"
        className="ep-statements__dl-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Download statement for ${row.period_label}`}
        onClick={() => setOpen((v) => !v)}
        disabled={Boolean(busy)}
      >
        <span aria-hidden>⇩</span>
      </button>
      {open ? (
        <div className="ep-statements__dl-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={busy === "pdf"}
            onClick={() => void download("pdf")}
          >
            {busy === "pdf" ? "PDF…" : "PDF"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy === "csv"}
            onClick={() => void download("csv")}
          >
            {busy === "csv" ? "CSV…" : "CSV"}
          </button>
        </div>
      ) : null}
      {error ? <div className="ep-statements__dl-error">{error}</div> : null}
    </div>
  );
}

export default function StatementsPanel() {
  const [rows, setRows] = useState<StatementPeriodRow[]>([]);
  const [accounts, setAccounts] = useState<
    Array<{ id: string; name: string; currency: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await statementsApi.list();
        if (cancelled) return;
        setRows(data.rows);
        setAccounts(
          data.accounts.map((a) => ({
            id: a.account_id,
            name: a.name,
            currency: a.currency,
          })),
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError || err instanceof Error
              ? err.message
              : "Couldn't load statements.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const years = useMemo(() => {
    const set = new Set(rows.map((r) => String(r.year)));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (accountFilter !== "all" && row.account_id !== accountFilter) return false;
      if (yearFilter !== "all" && String(row.year) !== yearFilter) return false;
      if (monthFilter !== "all" && String(row.month) !== monthFilter) return false;
      return true;
    });
  }, [rows, accountFilter, yearFilter, monthFilter]);

  const rowKey = (row: StatementPeriodRow) =>
    `${row.account_id}:${row.period_key}`;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selected[rowKey(r)]);

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const row of filtered) next[rowKey(row)] = true;
    setSelected(next);
  };

  return (
    <div className="ep-statements" data-screen-label="Statements">
      <div className="ep-statements__filters">
        <label className="ep-statements__filter">
          <span className="sr-only">Account</span>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="all">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ep-statements__filter">
          <span className="sr-only">Year</span>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="all">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="ep-statements__filter">
          <span className="sr-only">Month</span>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="all">All Months</option>
            {[
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ].map((label, idx) => (
              <option key={label} value={String(idx + 1)}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="ep-money-banner ep-money-banner--error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="ep-statements__table-wrap">
        <table className="ep-statements__table">
          <thead>
            <tr>
              <th className="ep-statements__check">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  aria-label="Select all statements"
                />
              </th>
              <th>Period</th>
              <th>Account</th>
              <th>Status</th>
              <th className="ep-statements__actions-col"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="ep-statements__empty">
                  Loading statements…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="ep-statements__empty">
                  No statements for these filters. Run a bulk payout or receive a
                  deposit, then refresh.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const key = rowKey(row);
                return (
                  <tr key={key}>
                    <td className="ep-statements__check">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[key])}
                        onChange={() =>
                          setSelected((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                        aria-label={`Select ${row.period_label} ${row.account_name}`}
                      />
                    </td>
                    <td className="ep-statements__period">{row.period_label}</td>
                    <td>
                      <span className="ep-statements__account">
                        <span className="ep-statements__account-icon" aria-hidden>
                          {currencyGlyph(row.currency, row.network)}
                        </span>
                        <span>
                          {row.account_name}{" "}
                          <span className="ep-statements__ccy">({row.currency})</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="ep-statements__badges">
                        {row.status.includes("MTD") ? (
                          <span className="ep-statements__badge ep-statements__badge--mtd">
                            MTD
                          </span>
                        ) : null}
                        {row.status.includes("AVAILABLE") ? (
                          <span className="ep-statements__badge ep-statements__badge--available">
                            AVAILABLE
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="ep-statements__actions-col">
                      <DownloadMenu row={row} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
