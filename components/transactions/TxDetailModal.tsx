"use client";
import React from "react";

export type TxDetailModalProps = {
  txDetail: any;
  /** True while the fetch-by-id (GET /v1/transactions/{id}) is in flight. */
  isLoading?: boolean;
  /** Non-null while the order hasn't reached a terminal status yet. */
  liveStatus?: { label: string; isFetching: boolean } | null;
};

export default function TxDetailModal({ txDetail, isLoading, liveStatus }: TxDetailModalProps) {
  if (!txDetail) {
    return isLoading ? (
      <div style={{ padding: "24px 0", textAlign: "center", fontSize: "12.5px", color: "var(--muted)" }}>
        Loading transaction…
      </div>
    ) : null;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "28px", fontWeight: "500", color: txDetail.amountColor }}>{txDetail.amount}</div>
        <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>{txDetail.flagUrl ? (<div style={{ width: "16px", height: "12px", borderRadius: "2px", backgroundImage: `url(${txDetail.flagUrl})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0" }} />) : null}{txDetail.client}</div>
        <span style={{ display: "inline-flex", marginTop: "8px", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: txDetail.statusSoft, color: txDetail.statusColor }}>{txDetail.statusLabel}</span>
      </div>
      {liveStatus ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "11.5px", fontWeight: "600", color: "var(--muted)", padding: "8px 10px", borderRadius: "10px", background: "var(--surface2)" }}>
          <span
            aria-hidden
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "var(--amber)",
              opacity: liveStatus.isFetching ? 1 : 0.5,
            }}
          />
          {liveStatus.label}
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "9px 0", borderBottom: "1px dashed var(--border)" }}><span style={{ color: "var(--muted)" }}>Reference</span><b style={{ fontFamily: "'DM Mono',monospace", fontWeight: "600" }}>{txDetail.ref}</b></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "9px 0", borderBottom: "1px dashed var(--border)" }}><span style={{ color: "var(--muted)" }}>Rail</span><b>{txDetail.type}</b></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "9px 0" }}><span style={{ color: "var(--muted)" }}>Settlement layer</span><b>USDC · Base</b></div>
    </div>
  );
}
