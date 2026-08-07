"use client";
import React from "react";
import ActivityList from "@/components/ui/ActivityList";

export type TxFilterChip = {
  label: string;
  select: () => void;
  bg: string;
  color: string;
  /** Optional explicit active flag; otherwise inferred from selected indigo styling. */
  active?: boolean;
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
};

function isFilterActive(tf: TxFilterChip): boolean {
  if (typeof tf.active === "boolean") return tf.active;
  return tf.bg === "var(--indigo)" || tf.color === "var(--indigo-on)";
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
}: TransactionsScreenProps) {
  const showPagination = total > 0 || hasPrev;

  return (
    <div className="ep-txn-screen" data-screen-label="Transactions">
      <div
        className="ep-txn-filters"
        role="group"
        aria-label="Filter transactions by status"
      >
        {(txFilters || []).map((tf) => {
          const active = isFilterActive(tf);
          return (
            <button
              key={tf.label}
              type="button"
              onClick={tf.select}
              className={`ep-txn-filter${active ? " ep-txn-filter--active" : ""}`}
              aria-pressed={active}
              style={{ background: tf.bg, color: tf.color }}
            >
              {tf.label}
            </button>
          );
        })}
      </div>

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
