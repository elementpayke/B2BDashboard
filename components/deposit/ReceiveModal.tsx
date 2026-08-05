"use client";
import React from "react";

export type ReceiveModalProps = {
  receiveGroups: any[];
  receiveIsFiat: boolean;
  receiveIsCrypto: boolean;
  receiveAcctChips: any[];
  receiveAcctRail: string;
  receiveAcctLines: any[];
  receiveAssets: any[];
  receiveNetworks: any[];
  receiveAssetCode: string;
  receiveNetworkLabel: string;
  receiveAddress: string;
  copyReceiveAddress: () => void;
  receiveAddressCopied: boolean;
};

export default function ReceiveModal(p: ReceiveModalProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <p style={{ margin: "0", fontSize: "12.5px", color: "var(--muted)" }}>Share these coordinates with whoever is paying you — no action needed on your end until funds land.</p>
      <div style={{ display: "flex", gap: "6px" }}>
        {(p.receiveGroups || []).map((rg: any, __i1: number) => (
          <React.Fragment key={__i1}>
            <button onClick={rg.select} style={{ padding: "9px 14px", borderRadius: "999px", border: "none", background: rg.bg, color: rg.color, fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>{rg.label}</button>
          </React.Fragment>
        ))}
      </div>

      {p.receiveIsFiat ? (
        <>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(p.receiveAcctChips || []).map((c: any, __i1: number) => (
              <React.Fragment key={__i1}>
                <button onClick={c.select} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px 7px 7px", borderRadius: "999px", border: `1.5px solid ${c.border}`, background: c.bg, color: "var(--ink)", cursor: "pointer" }}><div style={{ width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${c.flagUrl})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0" }} /><span style={{ fontSize: "12px", fontWeight: "700" }}>{c.code}</span></button>
              </React.Fragment>
            ))}
          </div>
          <p style={{ margin: "0", fontSize: "11.5px", color: "var(--muted2)" }}>{p.receiveAcctRail}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", borderRadius: "14px", background: "var(--surface2)" }}>
            {(p.receiveAcctLines || []).map((ln: any, __i1: number) => (
              <React.Fragment key={__i1}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px" }}>
                  <span style={{ color: "var(--muted)", whiteSpace: "nowrap", flexShrink: "0", width: "120px" }}>{ln.k}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: "600", flex: "1", wordBreak: "break-all" }}>{ln.v}</span>
                  <button onClick={ln.copy} style={{ flexShrink: "0", padding: "5px 10px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--surface)", fontSize: "10.5px", fontWeight: "700", cursor: "pointer" }}>{(ln.copied) ? (<>Copied</>) : (<>Copy</>)}</button>
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      ) : null}

      {p.receiveIsCrypto ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>Asset</span>
              <div style={{ display: "flex", gap: "4px", background: "var(--surface2)", padding: "3px", borderRadius: "10px" }}>
                {(p.receiveAssets || []).map((as: any, __i1: number) => (
                  <React.Fragment key={__i1}>
                    <button onClick={as.select} style={{ padding: "5px 10px", borderRadius: "8px", border: "none", background: as.bg, color: as.color, fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }}>{as.label}</button>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {(p.receiveNetworks || []).map((net: any, __i1: number) => (
                <React.Fragment key={__i1}>
                  <button onClick={net.select} style={{ padding: "8px 12px", borderRadius: "12px", border: `1.5px solid ${net.border}`, background: net.bg, color: net.color, fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>{net.label}</button>
                </React.Fragment>
              ))}
            </div>
            <div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--amber-tint)", color: "var(--amber)", fontSize: "12px", fontWeight: "600", lineHeight: "1.5" }}>Only accept {p.receiveAssetCode} on {p.receiveNetworkLabel} — funds sent on other networks cannot be recovered.</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 10px 10px 16px", borderRadius: "14px", background: "var(--surface2)", border: "1.5px solid var(--glass-border)" }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "14.5px", fontWeight: "600", letterSpacing: "0.02em", wordBreak: "break-all", lineHeight: "1.5" }}>{p.receiveAddress}</span>
              <button onClick={p.copyReceiveAddress} style={{ flexShrink: "0", display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--bg)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}><span style={{ fontSize: "14px" }}>⧉</span>{(p.receiveAddressCopied) ? (<>Copied</>) : (<>Copy</>)}</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
