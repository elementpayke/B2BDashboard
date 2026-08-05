"use client";
import React from "react";
import StatusBadge from "@/components/ui/StatusBadge";

export type AccountDetailRow = {
  label: string;
  value: string;
  copyValue?: string;
};

export type AccountDetailModalProps = {
  acctDetail: {
    currency: string;
    name: string;
    flagUrl: string | null;
    statusLabel: string;
    statusColor: string;
    statusSoft: string;
    rows: AccountDetailRow[];
    instructions?: string | null;
  } | null;
  copiedField: string;
  copyField: (fieldKey: string, value: string) => () => void;
  openModalSwapFromAcct: () => void;
};

export default function AccountDetailModal({ acctDetail, copiedField, copyField, openModalSwapFromAcct }: AccountDetailModalProps) {
  if (!acctDetail) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ textAlign: "center", padding: "2px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        {acctDetail.flagUrl ? (
          <div style={{ width: "36px", height: "27px", borderRadius: "4px", backgroundImage: `url(${acctDetail.flagUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : (
          <span style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px" }}>{acctDetail.currency.slice(0, 1)}</span>
        )}
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "17px", fontWeight: "700" }}>{acctDetail.name}</div>
        <StatusBadge label={acctDetail.statusLabel} color={acctDetail.statusColor} soft={acctDetail.statusSoft} size="md" />
      </div>

      {acctDetail.rows.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", borderRadius: "12px", background: "var(--surface2)" }}>
          {acctDetail.rows.map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px" }}>
              <span style={{ color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0, width: "120px" }}>{row.label}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: "600", flex: "1", wordBreak: "break-all" }}>{row.value}</span>
              {row.copyValue ? (
                <button type="button" onClick={copyField(row.label, row.copyValue)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--surface)", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                  {copiedField === row.label ? "Copied" : "Copy"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "12px 14px", borderRadius: "12px", background: "var(--surface2)", fontSize: "12.5px", color: "var(--muted)" }}>
          {acctDetail.instructions || "Deposit coordinates are being provisioned for this account."}
        </div>
      )}

      <button type="button" onClick={openModalSwapFromAcct} style={{ padding: "12px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Convert</button>
    </div>
  );
}
