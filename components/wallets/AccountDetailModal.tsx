"use client";
import React from "react";

export type AccountDetailModalProps = {
  acctDetail: any;
  openModalSwapFromAcct: () => void;
  onCopyDetail: () => void;
  copyLabel?: string;
};

export default function AccountDetailModal({
  acctDetail,
  openModalSwapFromAcct,
  onCopyDetail,
  copyLabel = "Copy",
}: AccountDetailModalProps) {
  if (!acctDetail) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ textAlign: "center", padding: "2px 0 8px" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>{(acctDetail.flagUrl) ? (<><div style={{ width: "36px", height: "27px", borderRadius: "4px", backgroundImage: `url(${acctDetail.flagUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} /></>) : (<><span style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px" }}>$</span></>)}</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "26px", fontWeight: "500", marginTop: "4px" }}>{acctDetail.balance}</div>
        <div style={{ fontSize: "12px", color: "var(--muted)" }}>{acctDetail.name} · {acctDetail.rail}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "12px 14px", borderRadius: "12px", background: "var(--surface2)" }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "12.5px", fontWeight: "600" }}>{acctDetail.detail}</span>
        <button type="button" onClick={onCopyDetail} style={{ flexShrink: "0", padding: "6px 12px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--surface)", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>{copyLabel}</button>
      </div>
      <button type="button" onClick={openModalSwapFromAcct} style={{ padding: "12px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Convert</button>
    </div>
  );
}
