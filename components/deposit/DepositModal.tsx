"use client";
import React from "react";

export type DepositModalProps = {
  depositNotDone: boolean;
  depositDone: boolean;
  depositStepDots: { on: boolean }[];
  depositStepIs1: boolean;
  depositStepIs2: boolean;
  depositStepIs3: boolean;
  depositMethods: any[];
  depositIsCountry: boolean;
  depositIsCrypto: boolean;
  depositCountryChips: any[];
  depositRailHasChoice: boolean;
  depositRailChips: any[];
  depositProviderHasChoice: boolean;
  depositProviderChips: any[];
  depositAssets: any[];
  depositNetworks: any[];
  depositNext: () => void;
  depositBack: () => void;
  depositDestinationSummary: string;
  depositIsMobileRail: boolean;
  depositIsBankRail: boolean;
  depositPayerLabel: string;
  depositPayerPlaceholder: string;
  depositPhone: string;
  setDepositPhone: (e: React.ChangeEvent<HTMLInputElement>) => void;
  depositMobileCode: string;
  depositAmount: string;
  setDepositAmount: (e: React.ChangeEvent<HTMLInputElement>) => void;
  depositAmountLabel: string;
  depositQuoteError: string;
  depositQuoteLoading: boolean;
  depositQuoteRateText: string | null;
  depositFeeText: string;
  depositArrivalText: string;
  depositAcceptError: string;
  depositAccepting: boolean;
  submitDeposit: () => void;
  depositResultText: string | null;
  depositLiveStatus: { label: string; color: string; soft: string; isSettling: boolean } | null;
  depositOperator: string;
  depositBankLabel: string;
  depositBankArrival: string;
  depositBankLines: any[];
  depositPromptSent: boolean;
  depositAssetCode: string;
  depositNetworkLabel: string;
  depositAddress: string;
  closeModal: () => void;
};

export default function DepositModal(p: DepositModalProps) {
  return (
    <>
      {p.depositNotDone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {(p.depositStepDots || []).map((d: any, __i1: number) => (
              <React.Fragment key={__i1}>
                <span style={{ height: "4px", flex: "1", borderRadius: "999px", background: d.on ? "var(--indigo)" : "var(--surface3)" }} />
              </React.Fragment>
            ))}
          </div>

          {p.depositStepIs1 ? (
            <>
              <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 1 · How are you topping up?</span>
              <div style={{ display: "flex", gap: "6px" }}>
                {(p.depositMethods || []).map((dm: any, __i1: number) => (
                  <React.Fragment key={__i1}>
                    <button onClick={dm.select} style={{ padding: "9px 14px", borderRadius: "999px", border: "none", background: dm.bg, color: dm.color, fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>{dm.label}</button>
                  </React.Fragment>
                ))}
              </div>

              {p.depositIsCountry ? (
                <>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {(p.depositCountryChips || []).map((c: any, __i1: number) => (
                      <React.Fragment key={__i1}>
                        <button onClick={c.selectDeposit} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px 7px 7px", borderRadius: "999px", border: `1.5px solid ${c.depositBorder}`, background: c.depositBg, color: "var(--ink)", cursor: "pointer" }}><div style={{ width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${c.flagUrl})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0" }} /><span style={{ fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}>{c.name}</span></button>
                      </React.Fragment>
                    ))}
                  </div>
                  {p.depositRailHasChoice ? (
                    <>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {(p.depositRailChips || []).map((r: any, __i1: number) => (
                          <React.Fragment key={__i1}>
                            <button onClick={r.select} style={{ padding: "8px 13px", borderRadius: "12px", border: "none", background: r.bg, color: r.color, fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>{r.label}</button>
                          </React.Fragment>
                        ))}
                      </div>
                    </>
                  ) : null}
                  {p.depositProviderHasChoice ? (
                    <>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Choose provider</span>
                        <div style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "6px 0 2px" }}>
                          {(p.depositProviderChips || []).map((pr: any, __i1: number) => (
                            <React.Fragment key={__i1}>
                              <button onClick={pr.select} style={{ padding: "8px 13px", borderRadius: "12px", border: `1.5px solid ${pr.border}`, background: pr.bg, color: "var(--ink)", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>{pr.name}</button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              {p.depositIsCrypto ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>Asset</span>
                    <div style={{ display: "flex", gap: "4px", background: "var(--surface2)", padding: "3px", borderRadius: "10px" }}>
                      {(p.depositAssets || []).map((as: any, __i1: number) => (
                        <React.Fragment key={__i1}>
                          <button onClick={as.select} style={{ padding: "5px 10px", borderRadius: "8px", border: "none", background: as.bg, color: as.color, fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }}>{as.label}</button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {(p.depositNetworks || []).map((net: any, __i1: number) => (
                      <React.Fragment key={__i1}>
                        <button onClick={net.select} style={{ padding: "8px 12px", borderRadius: "12px", border: `1.5px solid ${net.border}`, background: net.bg, color: net.color, fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>{net.label}</button>
                      </React.Fragment>
                    ))}
                  </div>
                </>
              ) : null}

              <button onClick={p.depositNext} style={{ padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer" }}>Continue</button>
            </>
          ) : null}

          {p.depositStepIs2 && p.depositIsCountry ? (
            <>
              <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 2 · Amount & source account</span>
              <div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontSize: "12px", fontWeight: "600" }}>{p.depositDestinationSummary}</div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.depositAmountLabel}</span>
                <input value={p.depositAmount} onChange={p.setDepositAmount} placeholder="0.00" style={{ width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box" }} />
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.depositPayerLabel}</span>
                {p.depositIsMobileRail ? (
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <div style={{ flex: "1", display: "flex", alignItems: "center", gap: "8px", padding: "11px 13px", borderRadius: "14px", background: "var(--input-bg)", border: "1.5px solid var(--input-border)" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>{p.depositMobileCode}</span>
                      <input value={p.depositPhone} onChange={p.setDepositPhone} placeholder={p.depositPayerPlaceholder} style={{ flex: "1", border: "none", background: "none", outline: "none", fontSize: "13px", fontWeight: "600", color: "var(--ink)", minWidth: "0" }} />
                    </div>
                  </div>
                ) : (
                  <input value={p.depositPhone} onChange={p.setDepositPhone} placeholder={p.depositPayerPlaceholder} style={{ width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box" }} />
                )}
              </div>
              {p.depositQuoteError ? (<div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: 600 }}>{p.depositQuoteError}</div>) : null}
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={p.depositBack} style={{ flex: "1", padding: "12px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Back</button>
                <button onClick={p.depositNext} disabled={p.depositQuoteLoading} style={{ flex: "2", padding: "12px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: p.depositQuoteLoading ? "wait" : "pointer", opacity: p.depositQuoteLoading ? 0.7 : 1 }}>{p.depositQuoteLoading ? "Getting quote…" : "Review"}</button>
              </div>
            </>
          ) : null}

          {p.depositStepIs2 && p.depositIsCrypto ? (
            <>
              <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 2 · {p.depositDestinationSummary}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: "600" }}>Only send {p.depositAssetCode} on {p.depositNetworkLabel} — other networks cannot be recovered.</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "11px 13px", borderRadius: "12px", background: "var(--surface2)" }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "12px", fontWeight: "600", wordBreak: "break-all" }}>{p.depositAddress}</span>
                  <button style={{ flexShrink: "0", padding: "6px 11px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--surface)", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Copy</button>
                </div>
              </div>
              <button onClick={p.depositBack} style={{ marginTop: "6px", padding: "11px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>Back</button>
            </>
          ) : null}

          {p.depositStepIs3 ? (
            <>
              <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 3 · Review & confirm</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px", borderRadius: "14px", background: "var(--surface2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>From</span><b>{p.depositPhone}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Via</span><b>{p.depositDestinationSummary}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Amount</span><b style={{ fontFamily: "'DM Mono',monospace" }}>{p.depositAmount}</b></div>
                {p.depositQuoteRateText ? (<div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>You receive</span><b style={{ fontFamily: "'DM Mono',monospace" }}>{p.depositQuoteRateText}</b></div>) : null}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Fee</span><b>{p.depositFeeText}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Valid until</span><b>{p.depositArrivalText}</b></div>
              </div>
              {p.depositAcceptError ? (<div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: 600 }}>{p.depositAcceptError}</div>) : null}
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={p.depositBack} style={{ flex: "1", padding: "12px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Back</button>
                <button onClick={p.submitDeposit} disabled={p.depositAccepting} style={{ flex: "2", padding: "12px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: p.depositAccepting ? "wait" : "pointer", opacity: p.depositAccepting ? 0.7 : 1 }}>{p.depositAccepting ? "Confirming…" : "Confirm top-up ↗"}</button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {p.depositDone ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center" }}>
          <span style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>✓</span>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700" }}>Top-up started</span>
          <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>{p.depositResultText}</span>
          {p.depositLiveStatus ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "2px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: p.depositLiveStatus.soft, color: p.depositLiveStatus.color }}>
              {p.depositLiveStatus.isSettling ? (
                <span aria-hidden style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" }} />
              ) : null}
              {p.depositLiveStatus.label}
            </span>
          ) : null}

          {p.depositIsMobileRail && p.depositPromptSent ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--indigo)", animation: "pulse-dot 1.2s ease-in-out infinite" }} /><span style={{ fontSize: "13px", fontWeight: "700" }}>Check your phone</span></div>
              <p style={{ margin: "0", fontSize: "12px", color: "var(--muted)" }}>Enter your PIN to approve the {p.depositOperator} prompt sent to {p.depositMobileCode} {p.depositPhone}.</p>
            </div>
          ) : null}

          {p.depositIsBankRail && p.depositBankLines.length > 0 ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px", textAlign: "left" }}>
              <p style={{ margin: "0", fontSize: "12.5px", color: "var(--muted)" }}>{p.depositBankLabel} via {p.depositOperator} · {p.depositBankArrival}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", borderRadius: "14px", background: "var(--surface2)" }}>
                {(p.depositBankLines || []).map((ln: any, __i1: number) => (
                  <React.Fragment key={__i1}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12.5px" }}><span style={{ color: "var(--muted)", whiteSpace: "nowrap", flexShrink: "0" }}>{ln.k}</span><span style={{ fontFamily: "'DM Mono',monospace", fontWeight: "600", textAlign: "right", flex: "1" }}>{ln.v}</span></div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : null}

          <button onClick={p.closeModal} style={{ marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>Done</button>
        </div>
      ) : null}
    </>
  );
}
