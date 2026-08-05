"use client";
import React from "react";
import ActivityList from "@/components/ui/ActivityList";
import StatusBadge from "@/components/ui/StatusBadge";

export type WalletsAccountCard = {
  currency: string;
  name: string;
  flagUrl: string | null;
  statusLabel: string;
  statusColor: string;
  statusSoft: string;
  primaryDetail: string;
  secondaryDetail: string;
  openDetail: () => void;
};

export type WalletsScreenProps = {
  isMobile: boolean;
  mainWalletBalance: string;
  mainWalletSub: string;
  stableTabs: any[];
  accountsCount: number;
  addAccountMenu: boolean;
  toggleAddAccountMenu: () => void;
  closeAddAccountMenu: () => void;
  openCreateAccount: (kind: string) => () => void;
  accounts: WalletsAccountCard[];
  /** True once verification has confirmed this principal can hold currency accounts. */
  eligible: boolean;
  eligibilityLoading: boolean;
  /** Human status from the eligibility check (e.g. "pending", "approved") when not yet eligible. */
  verificationStatus?: string;
  /** Set when the eligibility check itself failed (network/5xx) — distinct from a real "not eligible" result. */
  eligibilityErrorMessage?: string;
  accountsLoading: boolean;
  accountsErrorMessage?: string;
  walletsRecent: any[];
  goTransactions: () => void;
};

export default function WalletsScreen(p: WalletsScreenProps) {
  const showGate = !p.eligibilityLoading && !p.eligible && !p.eligibilityErrorMessage;
  const showAccountsRow = !showGate && !p.eligibilityErrorMessage;

  return (
    <div data-screen-label="Wallets" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ borderRadius: "24px", padding: p.isMobile ? "20px 18px" : "26px 30px", background: "var(--panel)", border: "1px solid var(--border)", position: "relative", overflow: "hidden", display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center" }}>
        <div style={{ flex: "1", minWidth: "min(220px, 100%)", position: "relative" }}>
          <span style={{ display: "inline-flex", fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--indigo-on)", background: "var(--indigo)", padding: "6px 14px", borderRadius: "999px", marginBottom: "12px" }}>Main wallet · settlement layer</span>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "clamp(24px, 6vw, 34px)", fontWeight: "500", letterSpacing: "-0.02em" }}>{p.mainWalletBalance}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{p.mainWalletSub}</div>
        </div>
        <div style={{ display: "flex", gap: "6px", background: "var(--surface2)", padding: "4px", borderRadius: "999px", border: "1px solid var(--glass-border)", position: "relative" }}>
          {(p.stableTabs || []).map((st: any, __i1: number) => (
            <React.Fragment key={__i1}>
              <button onClick={st.select} style={{ padding: "8px 18px", borderRadius: "999px", border: "none", background: st.bg, color: st.color, fontFamily: "'DM Mono',monospace", fontSize: "12.5px", fontWeight: "500", cursor: "pointer" }}>{st.label}</button>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h2 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700", letterSpacing: "0.02em", color: "var(--muted)", textTransform: "uppercase" }}>Currency accounts · {p.accountsCount}</h2>
        <div style={{ position: "relative" }}>
          <button onClick={p.toggleAddAccountMenu} style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "9px 16px", borderRadius: "999px", border: "none", background: "var(--ink-panel)", color: "#fff", fontFamily: "'Space Grotesk',sans-serif", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}><span style={{ fontSize: "14px", lineHeight: 1 }}>+</span>Add Account</button>
          {p.addAccountMenu ? (
            <>
              <div onClick={p.closeAddAccountMenu} style={{ position: "fixed", inset: "0", zIndex: 40 }} />
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: "0", zIndex: 41, minWidth: "212px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "16px", padding: "8px", boxShadow: "0 18px 40px rgba(19,17,38,0.16)" }}>
                <button onClick={p.openCreateAccount("bank")} style={{ display: "flex", alignItems: "center", gap: "11px", width: "100%", padding: "11px 12px", borderRadius: "11px", border: "none", background: "none", color: "var(--ink)", fontFamily: "'DM Sans',sans-serif", fontSize: "13.5px", fontWeight: "600", cursor: "pointer", textAlign: "left" }}><span style={{ fontSize: "15px", width: "18px", textAlign: "center" }}>🏛</span>Bank Account</button>
                <button onClick={p.openCreateAccount("stablecoin")} style={{ display: "flex", alignItems: "center", gap: "11px", width: "100%", padding: "11px 12px", borderRadius: "11px", border: "none", background: "none", color: "var(--ink)", fontFamily: "'DM Sans',sans-serif", fontSize: "13.5px", fontWeight: "600", cursor: "pointer", textAlign: "left" }}><span style={{ fontSize: "15px", width: "18px", textAlign: "center" }}>⊛</span>Stablecoin Account</button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {showGate ? (
        <div role="note" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "12px 14px", borderRadius: "14px", background: "var(--amber-tint)", border: "1px solid var(--border)", color: "var(--amber)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "999px", background: "var(--amber)", color: "#fff" }}>Verification required</span>
          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink)" }}>
            Complete business verification before issuing currency accounts
            {p.verificationStatus ? ` — current status: ${p.verificationStatus}.` : "."}
          </span>
        </div>
      ) : null}

      {p.eligibilityErrorMessage || p.accountsErrorMessage ? (
        <div role="alert" style={{ padding: "12px 14px", borderRadius: "14px", background: "var(--red-tint)", border: "1px solid var(--border)", color: "var(--red)", fontSize: "12.5px", fontWeight: 600 }}>
          {p.eligibilityErrorMessage || p.accountsErrorMessage}
        </div>
      ) : null}

      {showAccountsRow ? (
        <div className="ep-scroll-hint" style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "6px", scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" }}>
          {p.accountsLoading ? (
            <div style={{ flex: "0 0 230px", borderRadius: "20px", border: "1px dashed var(--border)", padding: "18px", color: "var(--muted)", fontSize: "12.5px" }}>Loading accounts…</div>
          ) : (
            (p.accounts || []).map((acc, __i1: number) => (
              <React.Fragment key={`${acc.currency}-${__i1}`}>
                <button type="button" onClick={acc.openDetail} style={{ flex: "0 0 230px", scrollSnapAlign: "start", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "20px", padding: "18px", display: "flex", flexDirection: "column", gap: "8px", cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "38px", height: "38px", borderRadius: "12px", background: "var(--indigo-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", color: "var(--indigo-text)", overflow: "hidden" }}>{acc.flagUrl ? (<div style={{ width: "100%", height: "100%", backgroundImage: `url(${acc.flagUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />) : (<>{acc.currency.slice(0, 1)}</>)}</span>
                      <div><div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700" }}>{acc.name}</div><div style={{ fontSize: "10.5px", color: "var(--muted2)", fontWeight: "600" }}>{acc.currency}</div></div>
                    </div>
                    <StatusBadge label={acc.statusLabel} color={acc.statusColor} soft={acc.statusSoft} size="sm" />
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "15.5px", fontWeight: "500", marginTop: "2px", wordBreak: "break-word" }}>{acc.primaryDetail}</div>
                  {acc.secondaryDetail ? (
                    <div style={{ fontSize: "11.5px", color: "var(--muted)", fontFamily: "'DM Mono',monospace" }}>{acc.secondaryDetail}</div>
                  ) : null}
                </button>
              </React.Fragment>
            ))
          )}
          <button onClick={p.openCreateAccount("bank")} style={{ flex: "0 0 150px", scrollSnapAlign: "start", border: "2px dashed var(--border)", background: "none", borderRadius: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "9px", color: "var(--muted)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
            <span style={{ width: "38px", height: "38px", borderRadius: "50%", background: "var(--indigo)", color: "var(--indigo-on)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px" }}>+</span>
            <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "13px", color: "var(--ink)" }}>New account</b>
          </button>
        </div>
      ) : null}

      <ActivityList title="Recent activity" items={p.walletsRecent} onViewAll={p.goTransactions} />

    </div>
  );
}
