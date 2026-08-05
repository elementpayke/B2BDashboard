"use client";
import React from "react";
import ActivityList from "@/components/ui/ActivityList";

export type TransactionsScreenProps = {
  txFilters: any[];
  filteredTransactions: any[];
  emptyLabel: string;
};

export default function TransactionsScreen({ txFilters, filteredTransactions, emptyLabel }: TransactionsScreenProps) {
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
    </div>
  );
}
