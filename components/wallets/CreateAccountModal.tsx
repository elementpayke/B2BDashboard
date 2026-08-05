"use client";
import React from "react";
import {
  CURRENCY_OPTIONS, STABLECOIN_OPTIONS, NETWORK_OPTIONS,
  isCurrencySupported,
} from "@/lib/services/depositAccounts";

export type CreateAccountModalProps = {
  createAccountName: string;
  setCreateAccountName: (e: React.ChangeEvent<HTMLInputElement>) => void;
  createAccountKind: string;
  createAccountCurrency: string;
  setCreateAccountCurrency: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  createAccountStablecoin: string;
  setCreateAccountStablecoin: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  createAccountNetwork: string;
  setCreateAccountNetwork: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  createAccountError: string;
  createAccountSaving: boolean;
  closeModal: () => void;
  submitCreateAccount: () => void;
};

export default function CreateAccountModal(p: CreateAccountModalProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <label htmlFor="create-account-name" style={{ fontSize: "12px", fontWeight: "600", color: "var(--ink)" }}>Account Name <span style={{ color: "var(--red)" }}>*</span></label>
        <input id="create-account-name" value={p.createAccountName} onChange={p.setCreateAccountName} placeholder="e.g. Payroll, Operations" style={{ width: "100%", marginTop: "8px", padding: "13px 14px", borderRadius: "12px", border: "1.5px solid var(--input-border)", background: "var(--surface2)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box" }} />
      </div>

      {p.createAccountKind === "bank" ? (
        <>
          <div>
            <label htmlFor="create-account-currency" style={{ fontSize: "12px", fontWeight: "600", color: "var(--ink)" }}>Currency <span style={{ color: "var(--red)" }}>*</span></label>
            <select id="create-account-currency" value={p.createAccountCurrency} onChange={p.setCreateAccountCurrency} style={{ width: "100%", marginTop: "8px", padding: "13px 14px", borderRadius: "12px", border: "1.5px solid var(--input-border)", background: "var(--surface2)", outline: "none", fontSize: "13.5px", color: p.createAccountCurrency ? "var(--ink)" : "var(--muted2)", boxSizing: "border-box", appearance: "none", cursor: "pointer" }}>
              <option value="">Select currency</option>
              {CURRENCY_OPTIONS.map((c: any) => (
                <option key={c.code} value={c.code} disabled={!isCurrencySupported(c.code)}>
                  {c.label} ({c.code}){isCurrencySupported(c.code) ? "" : " — not available yet"}
                </option>
              ))}
            </select>
            <div style={{ marginTop: "7px", fontSize: "11px", color: "var(--muted2)" }}>Bank accounts are currently issued in USD and EUR only.</div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="create-account-stablecoin" style={{ fontSize: "12px", fontWeight: "600", color: "var(--ink)" }}>Stablecoin <span style={{ color: "var(--red)" }}>*</span></label>
            <select id="create-account-stablecoin" value={p.createAccountStablecoin} onChange={p.setCreateAccountStablecoin} style={{ width: "100%", marginTop: "8px", padding: "13px 14px", borderRadius: "12px", border: "1.5px solid var(--input-border)", background: "var(--surface2)", outline: "none", fontSize: "13.5px", color: p.createAccountStablecoin ? "var(--ink)" : "var(--muted2)", boxSizing: "border-box", appearance: "none", cursor: "pointer" }}>
              <option value="">Select stablecoin</option>
              {STABLECOIN_OPTIONS.map((o: any) => (<option key={o.code} value={o.code}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label htmlFor="create-account-network" style={{ fontSize: "12px", fontWeight: "600", color: "var(--ink)" }}>Network <span style={{ color: "var(--red)" }}>*</span></label>
            <select id="create-account-network" value={p.createAccountNetwork} onChange={p.setCreateAccountNetwork} style={{ width: "100%", marginTop: "8px", padding: "13px 14px", borderRadius: "12px", border: "1.5px solid var(--input-border)", background: "var(--surface2)", outline: "none", fontSize: "13.5px", color: p.createAccountNetwork ? "var(--ink)" : "var(--muted2)", boxSizing: "border-box", appearance: "none", cursor: "pointer" }}>
              <option value="">Select network</option>
              {NETWORK_OPTIONS.map((o: any) => (<option key={o.code} value={o.code}>{o.label}</option>))}
            </select>
          </div>
        </>
      )}

      {p.createAccountError ? (<div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: 600 }}>{p.createAccountError}</div>) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "2px" }}>
        <button type="button" onClick={p.closeModal} style={{ padding: "12px 22px", borderRadius: "12px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Cancel</button>
        <button type="button" onClick={p.submitCreateAccount} disabled={p.createAccountSaving} style={{ padding: "12px 22px", borderRadius: "12px", border: "none", background: "var(--ink-panel)", color: "#fff", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13px", fontWeight: "700", cursor: p.createAccountSaving ? "wait" : "pointer", opacity: p.createAccountSaving ? 0.7 : 1 }}>{p.createAccountSaving ? "Creating…" : "Create Account"}</button>
      </div>
    </div>
  );
}
