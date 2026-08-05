"use client";
import React from "react";

/** Presentational Send modal body — props-driven; state lives in DashboardApp. */
export type SendModalProps = {
  sendNotDone: boolean;
  sendDone: boolean;
  sendStepDots: { on: boolean }[];
  sendStepIs1: boolean;
  sendStepIs2: boolean;
  sendStepIs3: boolean;
  sendGroups: any[];
  sendIsCountry: boolean;
  sendIsCrypto: boolean;
  sendCountryChips: any[];
  sendRailHasChoice: boolean;
  sendRailChips: any[];
  sendProviderHasChoice: boolean;
  sendProviderChips: any[];
  sendAssets: any[];
  sendChains: any[];
  sendAssetCode: string;
  sendChainLabel: string;
  sendNext: () => void;
  sendBack: () => void;
  sendDestinationSummary: string;
  sendRecipientName: string;
  setSendRecipientName: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sendRecipientLabel: string;
  sendRecipient: string;
  setSendRecipient: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sendRecipientPlaceholder: string;
  sendAmount: string;
  setSendAmount: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sendQuoteError: string;
  sendQuoteLoading: boolean;
  sendQuoteRateText: string | null;
  sendFeeText: string;
  sendArrivalText: string;
  sendAcceptError: string;
  sendAccepting: boolean;
  submitSend: () => void;
  sendResultText: string | null;
  /** Live order status (polled via lib/hooks/useOrderStatus), null for the simulated stablecoin tab. */
  sendLiveStatus: { label: string; color: string; soft: string; isSettling: boolean } | null;
  closeModal: () => void;
};

export default function SendModal(p: SendModalProps) {
  return (
    <>
      {p.sendNotDone ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              {(p.sendStepDots || []).map((d: any, __i1: number) => (
                <React.Fragment key={__i1}>
                  <span style={{ height: "4px", flex: "1", borderRadius: "999px", background: d.on ? "var(--indigo)" : "var(--surface3)" }} />
                </React.Fragment>
              ))}
            </div>

            {p.sendStepIs1 ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 1 · Where is this going?</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {(p.sendGroups || []).map((g: any, __i1: number) => (
                      <React.Fragment key={__i1}>
                        <button onClick={g.select} style={{ padding: "9px 13px", borderRadius: "999px", border: "none", background: g.bg, color: g.color, fontSize: "11.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>{g.label}</button>
                      </React.Fragment>
                    ))}
                  </div>
                  {p.sendIsCountry ? (
                    <>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recipient&apos;s country</span>
                        <div style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "8px 0 2px" }}>
                          {(p.sendCountryChips || []).map((c: any, __i1: number) => (
                            <React.Fragment key={__i1}>
                              <button onClick={c.selectSend} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 11px", borderRadius: "999px", border: `1.5px solid ${c.sendBorder}`, background: c.sendBg, color: "var(--ink)", cursor: "pointer", flexShrink: "0" }}><div style={{ width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${c.flagUrl})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0" }} /><span style={{ fontSize: "11.5px", fontWeight: "700" }}>{c.code}</span></button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      {p.sendRailHasChoice ? (
                        <>
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Payout rail</span>
                            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                              {(p.sendRailChips || []).map((r: any, __i1: number) => (
                                <React.Fragment key={__i1}>
                                  <button onClick={r.select} style={{ padding: "8px 13px", borderRadius: "12px", border: "none", background: r.bg, color: r.color, fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>{r.label}</button>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : null}
                      {p.sendProviderHasChoice ? (
                        <>
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Choose provider</span>
                            <div style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "6px 0 2px" }}>
                              {(p.sendProviderChips || []).map((pr: any, __i1: number) => (
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
                  {p.sendIsCrypto ? (
                    <>
                      <p style={{ margin: "0", fontSize: "12.5px", color: "var(--muted)" }}>Sends stablecoin directly on-chain — no bank or mobile money involved.</p>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Asset</span>
                        <div style={{ display: "flex", gap: "4px", background: "var(--surface2)", padding: "3px", borderRadius: "10px", marginTop: "6px", width: "fit-content" }}>
                          {(p.sendAssets || []).map((as: any, __i1: number) => (
                            <React.Fragment key={__i1}>
                              <button onClick={as.select} style={{ padding: "6px 12px", borderRadius: "8px", border: "none", background: as.bg, color: as.color, fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }}>{as.label}</button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Confirm the chain you&apos;re sending to</span>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                          {(p.sendChains || []).map((ch: any, __i1: number) => (
                            <React.Fragment key={__i1}>
                              <button onClick={ch.select} style={{ padding: "9px 14px", borderRadius: "12px", border: `1.5px solid ${ch.border}`, background: ch.bg, color: ch.color, fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>{ch.label}</button>
                            </React.Fragment>
                          ))}
                        </div>
                        <div style={{ marginTop: "8px", padding: "10px 12px", borderRadius: "12px", background: "var(--amber-tint)", color: "var(--amber)", fontSize: "11.5px", fontWeight: "600", lineHeight: "1.5" }}>Double-check the recipient accepts {p.sendAssetCode} on {p.sendChainLabel} — sending to the wrong network can lose funds.</div>
                      </div>
                    </>
                  ) : null}
                  <button onClick={p.sendNext} style={{ padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer" }}>Continue</button>
                </div>
              </>
            ) : null}

            {p.sendStepIs2 ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 2 · Recipient & amount</span>
                  <div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontSize: "12px", fontWeight: "600" }}>{p.sendDestinationSummary}</div>
                  {p.sendIsCountry ? (
                    <>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recipient&apos;s name</span>
                        <input value={p.sendRecipientName} onChange={p.setSendRecipientName} placeholder="e.g. Jane Mukami" style={{ width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box" }} />
                      </div>
                    </>
                  ) : null}
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.sendRecipientLabel}</span>
                    <input value={p.sendRecipient} onChange={p.setSendRecipient} placeholder={p.sendRecipientPlaceholder} style={{ width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Amount (USD)</span>
                    <input value={p.sendAmount} onChange={p.setSendAmount} placeholder="0.00" style={{ width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box" }} />
                  </div>
                  {p.sendQuoteError ? (<div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: 600 }}>{p.sendQuoteError}</div>) : null}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={p.sendBack} style={{ flex: "1", padding: "12px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Back</button>
                    <button onClick={p.sendNext} disabled={p.sendQuoteLoading} style={{ flex: "2", padding: "12px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: p.sendQuoteLoading ? "wait" : "pointer", opacity: p.sendQuoteLoading ? 0.7 : 1 }}>{p.sendQuoteLoading ? "Getting quote…" : "Review"}</button>
                  </div>
                </div>
              </>
            ) : null}

            {p.sendStepIs3 ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 3 · Review & confirm</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px", borderRadius: "14px", background: "var(--surface2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>To</span><b>{p.sendRecipient}</b></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Via</span><b>{p.sendDestinationSummary}</b></div>
                    {p.sendIsCrypto ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Network</span><b>{p.sendChainLabel}</b></div>
                      </>
                    ) : null}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Amount</span><b style={{ fontFamily: "'DM Mono',monospace" }}>${p.sendAmount}</b></div>
                    {p.sendQuoteRateText ? (<div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Recipient gets</span><b style={{ fontFamily: "'DM Mono',monospace" }}>{p.sendQuoteRateText}</b></div>) : null}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Fee</span><b>{p.sendFeeText}</b></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--muted)" }}>Arrival</span><b>{p.sendArrivalText}</b></div>
                  </div>
                  {p.sendAcceptError ? (<div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: 600 }}>{p.sendAcceptError}</div>) : null}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={p.sendBack} style={{ flex: "1", padding: "12px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Back</button>
                    <button onClick={p.submitSend} disabled={p.sendAccepting} style={{ flex: "2", padding: "12px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: p.sendAccepting ? "wait" : "pointer", opacity: p.sendAccepting ? 0.7 : 1 }}>{p.sendAccepting ? "Sending…" : "Confirm & send ↗"}</button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}
      {p.sendDone ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center" }}>
            <span style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>✓</span>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700" }}>Payment on its way</span>
            <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>{p.sendResultText || `$${p.sendAmount} to ${p.sendRecipient} · ${p.sendArrivalText}`}</span>
            {p.sendLiveStatus ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "2px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: p.sendLiveStatus.soft, color: p.sendLiveStatus.color }}>
                {p.sendLiveStatus.isSettling ? (
                  <span aria-hidden style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" }} />
                ) : null}
                {p.sendLiveStatus.label}
              </span>
            ) : null}
            <button onClick={p.closeModal} style={{ marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>Done</button>
          </div>
        </>
      ) : null}
    </>
  );
}
