"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/apiClient";
import {
  statementsApi,
  type StatementAccount,
  type StatementPeriodRow,
} from "@/lib/services/statements";

const MONTH_LABELS = [
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
];

function currencyGlyph(currency: string, network?: string | null): string {
  const c = (currency || "").toUpperCase();
  const n = (network || "").toLowerCase();
  if (c === "USDC" || c === "USDT" || c === "EURC") {
    if (n.includes("stellar")) return "✦";
    if (n.includes("polygon")) return "⬡";
    return "$";
  }
  return c.slice(0, 1) || "·";
}

function periodKeyNow(offsetMonths = 0): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function DownloadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="ep-statements__icon"
    >
      <path
        d="M8 2.5v7.2M8 9.7 5.4 7.1M8 9.7l2.6-2.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5v1a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 12.5v-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4.5 2.5h5.2L12.5 5.3V13a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9.5 2.5V5.5H12.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="3" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 6.5h11M2.5 10h11M6.5 3v10" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function DownloadMenu({
  row,
}: {
  row: StatementPeriodRow;
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
        aria-label={`Download ${row.period_label}`}
        title="Download"
        onClick={() => setOpen((v) => !v)}
        disabled={Boolean(busy)}
      >
        <DownloadIcon />
      </button>
      {open ? (
        <div className="ep-statements__dl-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={busy === "pdf"}
            onClick={() => void download("pdf")}
          >
            <FileIcon />
            <span>{busy === "pdf" ? "Preparing…" : "PDF statement"}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy === "csv"}
            onClick={() => void download("csv")}
          >
            <TableIcon />
            <span>{busy === "csv" ? "Preparing…" : "CSV for books"}</span>
          </button>
        </div>
      ) : null}
      {error ? <div className="ep-statements__dl-error">{error}</div> : null}
    </div>
  );
}

function StatusCell({ row }: { row: StatementPeriodRow }) {
  const inProgress = row.status.includes("MTD");
  return (
    <span
      className={[
        "ep-statements__status",
        inProgress ? "ep-statements__status--progress" : "ep-statements__status--ready",
      ].join(" ")}
    >
      <span className="ep-statements__status-dot" aria-hidden />
      {inProgress ? "In progress" : "Ready"}
    </span>
  );
}

type ComposerPreset = "this_month" | "last_month" | "last_3" | "ytd" | "custom";
type SortKey = "period" | "account" | "status";
type SortDir = "asc" | "desc";
type SortLevel = { key: SortKey; dir: SortDir };

const SORT_LABELS: Record<SortKey, string> = {
  period: "Period",
  account: "Account",
  status: "Status",
};

function defaultDirFor(column: SortKey): SortDir {
  return column === "period" ? "desc" : "asc";
}

function statusRank(row: StatementPeriodRow): number {
  // In progress (MTD) before Ready when ascending — active work first.
  return row.status.includes("MTD") ? 0 : 1;
}

function compareByKey(a: StatementPeriodRow, b: StatementPeriodRow, key: SortKey): number {
  if (key === "period") return a.period_key.localeCompare(b.period_key);
  if (key === "account") {
    return (
      a.account_name.localeCompare(b.account_name, undefined, { sensitivity: "base" }) ||
      a.currency.localeCompare(b.currency)
    );
  }
  return statusRank(a) - statusRank(b);
}

function SortHeader({
  label,
  column,
  sortStack,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortStack: SortLevel[];
  onSort: (column: SortKey, additive: boolean) => void;
}) {
  const levelIndex = sortStack.findIndex((s) => s.key === column);
  const active = levelIndex >= 0;
  const dir = active ? sortStack[levelIndex].dir : null;
  const priority = active ? levelIndex + 1 : null;
  return (
    <th aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={[
          "ep-statements__sort",
          active ? "ep-statements__sort--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        title="Click to sort · Shift+click to add another column"
        onClick={(e) => onSort(column, e.shiftKey)}
      >
        <span>{label}</span>
        {priority !== null && sortStack.length > 1 ? (
          <span className="ep-statements__sort-pri" aria-hidden>
            {priority}
          </span>
        ) : null}
        <span className="ep-statements__sort-mark" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function applyPreset(preset: ComposerPreset): { from: string; to: string } {
  const now = periodKeyNow(0);
  if (preset === "this_month") return { from: now, to: now };
  if (preset === "last_month") {
    const last = periodKeyNow(-1);
    return { from: last, to: last };
  }
  if (preset === "last_3") return { from: periodKeyNow(-2), to: now };
  if (preset === "ytd") {
    const year = new Date().getUTCFullYear();
    return { from: `${year}-01`, to: now };
  }
  return { from: now, to: now };
}

export default function StatementsPanel() {
  const [rows, setRows] = useState<StatementPeriodRow[]>([]);
  const [accounts, setAccounts] = useState<StatementAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerAccountId, setComposerAccountId] = useState("");
  const [composerFrom, setComposerFrom] = useState(periodKeyNow(0));
  const [composerTo, setComposerTo] = useState(periodKeyNow(0));
  const [composerPreset, setComposerPreset] = useState<ComposerPreset>("this_month");
  const [composerFormat, setComposerFormat] = useState<"pdf" | "csv">("pdf");
  const [composerBusy, setComposerBusy] = useState(false);
  const [composerError, setComposerError] = useState("");
  /** Ordered sort levels — index 0 is primary. Shift+click adds secondary/tertiary. */
  const [sortStack, setSortStack] = useState<SortLevel[]>([
    { key: "period", dir: "desc" },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await statementsApi.list();
        if (cancelled) return;
        setRows(data.rows);
        setAccounts(data.accounts);
        if (data.accounts[0] && !composerAccountId) {
          setComposerAccountId(data.accounts[0].account_id);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, []);

  const years = useMemo(() => {
    const set = new Set(rows.map((r) => String(r.year)));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [rows]);

  const periodOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) keys.add(row.period_key);
    // Always offer a rolling 12 months so the composer works even with sparse history.
    for (let i = 0; i < 12; i += 1) keys.add(periodKeyNow(-i));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (accountFilter !== "all" && row.account_id !== accountFilter) return false;
      if (yearFilter !== "all" && String(row.year) !== yearFilter) return false;
      if (monthFilter !== "all" && String(row.month) !== monthFilter) return false;
      return true;
    });
  }, [rows, accountFilter, yearFilter, monthFilter]);

  const sorted = useMemo(() => {
    const levels =
      sortStack.length > 0 ? sortStack : ([{ key: "period", dir: "desc" }] as SortLevel[]);
    const next = [...filtered];
    next.sort((a, b) => {
      for (const level of levels) {
        const cmp = compareByKey(a, b, level.key) * (level.dir === "asc" ? 1 : -1);
        if (cmp !== 0) return cmp;
      }
      // Stable tie-break so rows don't jump randomly.
      return (
        a.period_key.localeCompare(b.period_key) ||
        a.account_name.localeCompare(b.account_name)
      );
    });
    return next;
  }, [filtered, sortStack]);

  const toggleSort = (column: SortKey, additive: boolean) => {
    setSortStack((prev) => {
      const idx = prev.findIndex((s) => s.key === column);
      if (additive) {
        if (idx >= 0) {
          return prev.map((s, i) =>
            i === idx ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" } : s,
          );
        }
        if (prev.length >= 3) {
          // Replace last level when already at max depth.
          return [...prev.slice(0, 2), { key: column, dir: defaultDirFor(column) }];
        }
        return [...prev, { key: column, dir: defaultDirFor(column) }];
      }
      // Plain click: if this is the only/primary column, flip dir; else reset to this alone.
      if (idx === 0 && prev.length === 1) {
        return [{ key: column, dir: prev[0].dir === "asc" ? "desc" : "asc" }];
      }
      if (idx === 0 && prev.length > 1) {
        return prev.map((s, i) =>
          i === 0 ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" } : s,
        );
      }
      return [{ key: column, dir: defaultDirFor(column) }];
    });
  };

  const removeSortLevel = (column: SortKey) => {
    setSortStack((prev) => {
      const next = prev.filter((s) => s.key !== column);
      return next.length ? next : [{ key: "period", dir: "desc" }];
    });
  };

  const clearSortStack = () => setSortStack([{ key: "period", dir: "desc" }]);

  const rowKey = (row: StatementPeriodRow) => `${row.account_id}:${row.period_key}`;

  const selectedRows = useMemo(
    () => sorted.filter((r) => selected[rowKey(r)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sorted, selected],
  );

  const allFilteredSelected =
    sorted.length > 0 && sorted.every((r) => selected[rowKey(r)]);

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const row of sorted) next[rowKey(row)] = true;
    setSelected(next);
  };

  const openComposer = (prefill?: {
    accountId?: string;
    from?: string;
    to?: string;
  }) => {
    setComposerError("");
    if (prefill?.accountId) setComposerAccountId(prefill.accountId);
    else if (!composerAccountId && accounts[0]) setComposerAccountId(accounts[0].account_id);
    if (prefill?.from && prefill?.to) {
      setComposerFrom(prefill.from);
      setComposerTo(prefill.to);
      setComposerPreset("custom");
    }
    setComposerOpen(true);
  };

  const onPreset = (preset: ComposerPreset) => {
    setComposerPreset(preset);
    if (preset === "custom") return;
    const next = applyPreset(preset);
    setComposerFrom(next.from);
    setComposerTo(next.to);
  };

  const downloadWhole = async () => {
    const account = accounts.find((a) => a.account_id === composerAccountId);
    if (!account) {
      setComposerError("Choose an account.");
      return;
    }
    if (composerFrom > composerTo) {
      setComposerError("End month must be on or after the start.");
      return;
    }
    setComposerBusy(true);
    setComposerError("");
    try {
      await statementsApi.downloadRange({
        entityId: account.entity_id,
        accountId: account.account_id,
        from: composerFrom,
        to: composerTo,
        format: composerFormat,
      });
    } catch (err) {
      setComposerError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Couldn't download statement.",
      );
    } finally {
      setComposerBusy(false);
    }
  };

  const downloadSelectedAsRange = () => {
    if (!selectedRows.length) return;
    const accountId = selectedRows[0].account_id;
    const sameAccount = selectedRows.every((r) => r.account_id === accountId);
    if (!sameAccount) {
      setError("Select periods from one account to download a combined statement.");
      return;
    }
    const keys = selectedRows.map((r) => r.period_key).sort();
    openComposer({ accountId, from: keys[0], to: keys[keys.length - 1] });
  };

  const formatPeriodOption = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    if (!y || !m) return key;
    return `${MONTH_LABELS[m - 1]} ${y}`;
  };

  return (
    <div className="ep-statements" data-screen-label="Statements">
      <div className="ep-statements__toolbar">
        <div className="ep-statements__filters">
          <label className="ep-statements__filter">
            <span className="sr-only">Account</span>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option value="all">All accounts</option>
              {accounts.map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ep-statements__filter">
            <span className="sr-only">Year</span>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="all">All years</option>
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
              <option value="all">All months</option>
              {MONTH_LABELS.map((label, idx) => (
                <option key={label} value={String(idx + 1)}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ep-statements__toolbar-actions">
          {selectedRows.length > 0 ? (
            <button
              type="button"
              className="ep-btn-secondary ep-statements__sel-btn"
              onClick={downloadSelectedAsRange}
            >
              Use selection ({selectedRows.length})
            </button>
          ) : null}
          <button
            type="button"
            className="ep-btn-primary ep-statements__primary"
            onClick={() => openComposer()}
          >
            <DownloadIcon size={15} />
            Download statement
          </button>
        </div>
      </div>

      {composerOpen ? (
        <div className="ep-statements__composer" role="region" aria-label="Download statement">
          <div className="ep-statements__composer-head">
            <div>
              <div className="ep-statements__composer-title">Download statement</div>
              <p className="ep-statements__composer-sub">
                One file for an account and timeline — PDF for records, CSV for books.
              </p>
            </div>
            <button
              type="button"
              className="ep-statements__composer-close"
              onClick={() => setComposerOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="ep-statements__presets" role="group" aria-label="Timeline presets">
            {(
              [
                ["this_month", "This month"],
                ["last_month", "Last month"],
                ["last_3", "Last 3 months"],
                ["ytd", "Year to date"],
                ["custom", "Custom"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={[
                  "ep-statements__preset",
                  composerPreset === id ? "ep-statements__preset--on" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onPreset(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ep-statements__composer-grid">
            <label className="ep-statements__field">
              <span>Account</span>
              <select
                value={composerAccountId}
                onChange={(e) => setComposerAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.account_id} value={a.account_id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </label>
            <label className="ep-statements__field">
              <span>From</span>
              <select
                value={composerFrom}
                onChange={(e) => {
                  setComposerPreset("custom");
                  setComposerFrom(e.target.value);
                }}
              >
                {periodOptions.map((key) => (
                  <option key={key} value={key}>
                    {formatPeriodOption(key)}
                  </option>
                ))}
              </select>
            </label>
            <label className="ep-statements__field">
              <span>To</span>
              <select
                value={composerTo}
                onChange={(e) => {
                  setComposerPreset("custom");
                  setComposerTo(e.target.value);
                }}
              >
                {periodOptions.map((key) => (
                  <option key={key} value={key}>
                    {formatPeriodOption(key)}
                  </option>
                ))}
              </select>
            </label>
            <div className="ep-statements__field">
              <span>Format</span>
              <div className="ep-statements__format" role="group" aria-label="Format">
                <button
                  type="button"
                  className={composerFormat === "pdf" ? "is-on" : ""}
                  onClick={() => setComposerFormat("pdf")}
                >
                  PDF
                </button>
                <button
                  type="button"
                  className={composerFormat === "csv" ? "is-on" : ""}
                  onClick={() => setComposerFormat("csv")}
                >
                  CSV
                </button>
              </div>
            </div>
          </div>

          {composerError ? (
            <div className="ep-statements__composer-error" role="alert">
              {composerError}
            </div>
          ) : null}

          <div className="ep-statements__composer-actions">
            <button
              type="button"
              className="ep-btn-secondary"
              onClick={() => setComposerOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ep-btn-primary"
              disabled={composerBusy || !composerAccountId}
              onClick={() => void downloadWhole()}
            >
              {composerBusy ? "Preparing…" : `Download ${composerFormat.toUpperCase()}`}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="ep-money-banner ep-money-banner--error" role="alert">
          {error}
        </div>
      ) : null}

      {sortStack.length > 1 ? (
        <div className="ep-statements__sort-bar" aria-label="Active sorts">
          <span className="ep-statements__sort-bar-label">Sorted by</span>
          {sortStack.map((level, i) => (
            <button
              key={level.key}
              type="button"
              className="ep-statements__sort-chip"
              title="Click to remove this sort level"
              onClick={() => removeSortLevel(level.key)}
            >
              <span className="ep-statements__sort-pri">{i + 1}</span>
              {SORT_LABELS[level.key]} {level.dir === "asc" ? "↑" : "↓"}
              <span aria-hidden>×</span>
            </button>
          ))}
          <button
            type="button"
            className="ep-statements__sort-clear"
            onClick={clearSortStack}
          >
            Reset
          </button>
          <span className="ep-statements__sort-hint">Shift+click a column to add</span>
        </div>
      ) : (
        <p className="ep-statements__sort-hint-solo">
          Tip: Shift+click another column header to sort by two fields (e.g. Status, then Account).
        </p>
      )}

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
              <SortHeader
                label="Period"
                column="period"
                sortStack={sortStack}
                onSort={toggleSort}
              />
              <SortHeader
                label="Account"
                column="account"
                sortStack={sortStack}
                onSort={toggleSort}
              />
              <SortHeader
                label="Status"
                column="status"
                sortStack={sortStack}
                onSort={toggleSort}
              />
              <th className="ep-statements__actions-col">Download</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="ep-statements__empty">
                  Loading statements…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="ep-statements__empty">
                  No periods for these filters. Use{" "}
                  <button
                    type="button"
                    className="ep-statements__inline-link"
                    onClick={() => openComposer()}
                  >
                    Download statement
                  </button>{" "}
                  to pull a custom timeline, or wait for activity.
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const key = rowKey(row);
                const current = row.status.includes("MTD");
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
                    <td className="ep-statements__period">
                      <span className="ep-statements__period-main">{row.period_label}</span>
                      {current ? (
                        <span className="ep-statements__period-tag">Current</span>
                      ) : null}
                    </td>
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
                      <StatusCell row={row} />
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
