"use client";
import React from "react";
import ActivityList from "@/components/ui/ActivityList";

export type TransactionsScreenProps = {
  txFilters: any[];
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
    <div data-screen-label="Transactions" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {(txFilters || []).map((tf: any, __i1: number) => (
          <React.Fragment key={__i1}>
            <button onClick={tf.select} style={{ fontSize: "12px", fontWeight: "700", padding: "10px 15px", minHeight: "40px", borderRadius: "999px", background: tf.bg, color: tf.color, border: "1px solid var(--glass-border)", cursor: "pointer" }}>{tf.label}</button>
          </React.Fragment>
        ))}
      </div>
      <ActivityList
        title="Transactions"
        items={filteredTransactions}
        columns="transactions"
        emptyLabel={emptyLabel}
      />
      {showPagination ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
            Page {pageNumber} of {pageCount}
            {total > 0 ? ` · ${total} total` : ""}
            {isFetching ? " · Updating…" : ""}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onPrevPage}
              disabled={!hasPrev}
              style={{
                fontSize: "12px",
                fontWeight: "700",
                padding: "10px 16px",
                minHeight: "40px",
                borderRadius: "999px",
                background: hasPrev ? "var(--surface2)" : "var(--surface3)",
                color: hasPrev ? "var(--ink)" : "var(--muted)",
                border: "1px solid var(--glass-border)",
                cursor: hasPrev ? "pointer" : "not-allowed",
                opacity: hasPrev ? 1 : 0.6,
              }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={onNextPage}
              disabled={!hasNext}
              style={{
                fontSize: "12px",
                fontWeight: "700",
                padding: "10px 16px",
                minHeight: "40px",
                borderRadius: "999px",
                background: hasNext ? "var(--indigo)" : "var(--surface3)",
                color: hasNext ? "var(--indigo-on)" : "var(--muted)",
                border: "1px solid var(--glass-border)",
                cursor: hasNext ? "pointer" : "not-allowed",
                opacity: hasNext ? 1 : 0.6,
              }}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
