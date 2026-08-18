"use client";
import React from "react";
import ActivityList from "@/components/ui/ActivityList";

export type TxFilterChip = {
  key: string;
  label: string;
  select: () => void;
  active: boolean;
};

export type TransactionsScreenProps = {
  txFilters: TxFilterChip[];
  filteredTransactions: any[];
  emptyLabel: string;
  pageNumber: number;
  pageCount: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  isFetching?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  currency: string;
  currencyOptions: string[];
  onCurrencyChange: (value: string) => void;
  dateRange: "all" | "7d" | "30d";
  onDateRangeChange: (value: "all" | "7d" | "30d") => void;
  usesLatestFifty?: boolean;
};

function isFilterActive(tf: TxFilterChip): boolean {
  return tf.active;
}

export default function TransactionsScreen({
  txFilters,
  filteredTransactions,
  emptyLabel,
  pageNumber,
  pageCount,
  total,
  hasNext,
  hasPrev,
  onNextPage,
  onPrevPage,
  isFetching = false,
  search,
  onSearchChange,
  currency,
  currencyOptions,
  onCurrencyChange,
  dateRange,
  onDateRangeChange,
  usesLatestFifty = false,
}: TransactionsScreenProps) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const filterSheetRef = React.useRef<HTMLDivElement>(null);
  const filterTriggerRef = React.useRef<HTMLButtonElement>(null);
  const showPagination = !usesLatestFifty && (total > 0 || hasPrev);

  React.useEffect(() => {
    if (!filtersOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const sheet = filterSheetRef.current;
    sheet?.querySelector<HTMLElement>("button, select, input, [tabindex]:not([tabindex='-1'])")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sheet) return;
      const focusable = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          "button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      (previousFocus?.isConnected ? previousFocus : filterTriggerRef.current)?.focus();
    };
  }, [filtersOpen]);

  const advancedFilters = (
    <div className="ep-txn-advanced-fields">
      <label>
        <span>Currency</span>
        <select value={currency} onChange={(event) => onCurrencyChange(event.target.value)}>
          <option value="all">All currencies</option>
          {currencyOptions.map((code) => (
            <option value={code} key={code}>{code}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Date</span>
        <select
          value={dateRange}
          onChange={(event) =>
            onDateRangeChange(event.target.value as "all" | "7d" | "30d")
          }
        >
          <option value="all">Any time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </label>
    </div>
  );

  return (
    <div className="ep-txn-screen" data-screen-label="Transactions">
      <div className="ep-txn-toolbar">
        <label className="ep-txn-search">
          <span className="ep-activity__sr">Search transactions</span>
          <span aria-hidden>⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search ID, provider, amount, currency…"
          />
        </label>
        <div className="ep-txn-advanced-desktop">{advancedFilters}</div>
        <button
          ref={filterTriggerRef}
          type="button"
          className="ep-txn-advanced-mobile ep-txn-filter-trigger"
          onClick={() => setFiltersOpen(true)}
          aria-expanded={filtersOpen}
          aria-controls="transaction-filter-sheet"
        >
          Filters
        </button>
      </div>
      <div
        className="ep-txn-filters"
        role="group"
        aria-label="Filter transactions by status"
      >
        {(txFilters || []).map((tf) => {
          const active = isFilterActive(tf);
          return (
            <button
              key={tf.key}
              type="button"
              onClick={tf.select}
              className={`ep-txn-filter${active ? " ep-txn-filter--active" : ""}`}
              aria-pressed={active}
            >
              {tf.label}
            </button>
          );
        })}
      </div>

      {usesLatestFifty ? (
        <p className="ep-txn-scope-note" role="note">
          Showing matches in the latest 50 transactions. Clear search, direction, currency,
          and date filters to browse the full history.
        </p>
      ) : null}

      {filtersOpen ? (
        <div className="ep-txn-filter-overlay" onMouseDown={() => setFiltersOpen(false)}>
          <div
            ref={filterSheetRef}
            id="transaction-filter-sheet"
            className="ep-txn-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-filter-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ep-txn-filter-sheet__header">
              <div>
                <span>Transactions</span>
                <h2 id="transaction-filter-title">Filter activity</h2>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                ✕
              </button>
            </div>
            {advancedFilters}
          </div>
        </div>
      ) : null}

      <ActivityList
        title="Transactions"
        items={filteredTransactions}
        columns="transactions"
        emptyLabel={emptyLabel}
        showHeader={false}
      />

      {showPagination ? (
        <nav className="ep-txn-pager" aria-label="Transaction pages">
          <span className="ep-txn-pager__meta" aria-live="polite">
            Page {pageNumber} of {pageCount}
            {total > 0 ? ` · ${total} total` : ""}
            {isFetching ? (
              <span className="ep-txn-pager__updating"> · Updating…</span>
            ) : null}
          </span>
          <div className="ep-txn-pager__actions">
            <button
              type="button"
              onClick={onPrevPage}
              disabled={!hasPrev}
              className="ep-txn-pager__btn"
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={onNextPage}
              disabled={!hasNext}
              className={`ep-txn-pager__btn${hasNext ? " ep-txn-pager__btn--primary" : ""}`}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
