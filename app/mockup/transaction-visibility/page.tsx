"use client";

import React, { useState } from "react";
import { mockTransactions, computeTransactionDisplay, getMockTransactionWithDetail } from "@/lib/mockData/transactionsMockup";

export default function TransactionVisibilityMockup() {
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const selectedTx = selectedTxId ? getMockTransactionWithDetail(selectedTxId) : null;

  return (
    <div style={{ padding: "24px", backgroundColor: "#f5f5f5", minHeight: "100vh", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ marginTop: 0, marginBottom: "8px", fontSize: "28px" }}>
          Transaction Visibility Mockup
        </h1>
        <p style={{ color: "#666", marginBottom: "24px" }}>
          Enhanced dashboard showing real-time transaction stages, settlement distinction, and attention flags
        </p>

        {/* Transaction List */}
        <div style={{ backgroundColor: "white", borderRadius: "8px", padding: "20px", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h2 style={{ fontSize: "18px", marginTop: 0, marginBottom: "16px" }}>
            Transactions
          </h2>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e5e5" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Status
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Route & Amount
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Elapsed
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Next Step / Waiting On
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    ⚠️
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockTransactions.map((tx) => {
                  const display = computeTransactionDisplay(tx);
                  const route = `${tx.source_chain.toUpperCase()} → ${tx.dest_chain.toUpperCase()}`;

                  return (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: "1px solid #e5e5e5",
                        backgroundColor: selectedTxId === tx.id ? "#f0f7ff" : "transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedTxId(tx.id)}
                    >
                      <td style={{ padding: "12px", verticalAlign: "top" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 500,
                            backgroundColor:
                              tx.status === "completed"
                                ? "#dcfce7"
                                : tx.status === "failed"
                                  ? "#fee2e2"
                                  : "#fef3c7",
                            color:
                              tx.status === "completed"
                                ? "#166534"
                                : tx.status === "failed"
                                  ? "#991b1b"
                                  : "#92400e",
                          }}
                        >
                          {display.currentStage}
                        </span>
                      </td>
                      <td style={{ padding: "12px", verticalAlign: "top" }}>
                        <div style={{ fontSize: "13px", fontWeight: 500 }}>
                          {route}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                          ${tx.amount_usdc} USDC
                        </div>
                      </td>
                      <td style={{ padding: "12px", verticalAlign: "top", fontWeight: 500 }}>
                        {display.elapsedDisplay}
                      </td>
                      <td style={{ padding: "12px", verticalAlign: "top", fontSize: "12px", color: "#666" }}>
                        {display.nextAction}
                      </td>
                      <td style={{ padding: "12px", verticalAlign: "top", textAlign: "center" }}>
                        {display.needsAttention ? (
                          <span style={{ fontSize: "18px" }}>⚠️</span>
                        ) : (
                          <span style={{ color: "#ccc" }}>·</span>
                        )}
                      </td>
                      <td style={{ padding: "12px", verticalAlign: "top" }}>
                        <button
                          onClick={() => setSelectedTxId(tx.id)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#0066cc",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 500,
                          }}
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Detail View */}
        {selectedTx && (
          <div style={{ backgroundColor: "white", borderRadius: "8px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", margin: 0 }}>
                Transaction Detail: {selectedTx.id}
              </h2>
              <button
                onClick={() => setSelectedTxId(null)}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#f0f0f0",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Close
              </button>
            </div>

            {/* Status Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
              <div style={{ padding: "12px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Route
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "4px" }}>
                  {selectedTx.source_chain.toUpperCase()} → {selectedTx.dest_chain.toUpperCase()}
                </div>
              </div>
              <div style={{ padding: "12px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Amount
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "4px" }}>
                  ${selectedTx.amount_usdc} USDC
                </div>
              </div>
              <div style={{ padding: "12px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Total Elapsed
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "4px" }}>
                  {computeTransactionDisplay(selectedTx).elapsedMinutes} minutes
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", marginTop: 0 }}>
                Stage Timeline
              </h3>
              <div style={{ position: "relative", paddingLeft: "24px" }}>
                {selectedTx.stages.map((stage: any, index: number) => (
                  <div key={index} style={{ marginBottom: index < selectedTx.stages.length - 1 ? "24px" : 0 }}>
                    {/* Timeline dot */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: "#0066cc",
                        border: "2px solid white",
                        boxShadow: "0 0 0 2px #0066cc",
                      }}
                    />
                    {/* Timeline line */}
                    {index < selectedTx.stages.length - 1 && (
                      <div
                        style={{
                          position: "absolute",
                          left: "5px",
                          top: "12px",
                          width: "2px",
                          height: "24px",
                          backgroundColor: "#ddd",
                        }}
                      />
                    )}

                    {/* Stage content */}
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px", textTransform: "capitalize" }}>
                        {stage.stage}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                        Chain: <strong>{stage.chain}</strong> | Payer: <strong>{stage.payer.replace("_", " ")}</strong>
                      </div>
                      {stage.tx_hash && (
                        <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#0066cc", marginBottom: "4px", wordBreak: "break-all" }}>
                          {stage.tx_hash.slice(0, 16)}...{stage.tx_hash.slice(-16)}
                        </div>
                      )}
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        Gas: {stage.fee.gas_native} {stage.fee.unit} (${stage.fee.gas_usd.toFixed(2)})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Settlement Status */}
            <div style={{ marginBottom: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ padding: "16px", backgroundColor: "#e8f5e9", borderRadius: "4px", border: "1px solid #c8e6c9" }}>
                <h4 style={{ fontSize: "13px", fontWeight: 600, marginTop: 0, marginBottom: "8px" }}>
                  Crypto Settlement
                </h4>
                {selectedTx.crypto_settlement.confirmed ? (
                  <div>
                    <div style={{ fontSize: "12px", color: "#2e7d32", marginBottom: "4px" }}>
                      ✓ Confirmed
                    </div>
                    <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#666", wordBreak: "break-all" }}>
                      {selectedTx.crypto_settlement.tx_hash?.slice(0, 16)}...{selectedTx.crypto_settlement.tx_hash?.slice(-16)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    {selectedTx.crypto_settlement.status === "failed" ? "❌ Failed" : "⏳ Pending"}
                  </div>
                )}
              </div>
              <div style={{ padding: "16px", backgroundColor: "#fff3e0", borderRadius: "4px", border: "1px solid #ffe0b2" }}>
                <h4 style={{ fontSize: "13px", fontWeight: 600, marginTop: 0, marginBottom: "8px" }}>
                  Fiat Settlement
                </h4>
                <div style={{ fontSize: "12px", color: "#e65100" }}>
                  ⏳ {selectedTx.fiat_settlement.message}
                </div>
                <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
                  ({selectedTx.fiat_settlement.psp_name})
                </div>
              </div>
            </div>

            {/* Fee Breakdown */}
            <div style={{ padding: "16px", backgroundColor: "#f9f9f9", borderRadius: "4px", marginBottom: "24px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, marginTop: 0, marginBottom: "8px" }}>
                Fee Breakdown
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "12px 16px", fontSize: "12px" }}>
                <div>Circle Fee:</div>
                <div />
                <div>${selectedTx.circle_fee_usdc}</div>
                <div>Element Gas (Sponsor):</div>
                <div />
                <div>${selectedTx.total_element_gas_usd.toFixed(2)}</div>
              </div>
            </div>

            {/* Webhook Delivery Status */}
            <div style={{ padding: "16px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, marginTop: 0, marginBottom: "8px" }}>
                Settlement Notifications
              </h4>
              <div style={{ fontSize: "12px" }}>
                <div style={{ marginBottom: "4px" }}>
                  Status: <strong>{selectedTx.webhook_delivery.status}</strong>
                </div>
                <div style={{ marginBottom: "4px" }}>
                  Attempts: <strong>{selectedTx.webhook_delivery.attempts}</strong>
                </div>
                {selectedTx.webhook_delivery.error && (
                  <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#ffebee", borderRadius: "3px", color: "#c62828" }}>
                    Error: {selectedTx.webhook_delivery.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: "32px", padding: "16px", backgroundColor: "white", borderRadius: "8px", fontSize: "12px" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, marginTop: 0, marginBottom: "12px" }}>
            Legend
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <strong>Status Colors:</strong>
              <div style={{ marginTop: "8px", fontSize: "11px" }}>
                🟨 Yellow = In progress (detected, burning, attesting, minting)
              </div>
              <div style={{ marginTop: "4px", fontSize: "11px" }}>
                🟩 Green = Completed/Credited
              </div>
              <div style={{ marginTop: "4px", fontSize: "11px" }}>
                🟥 Red = Failed
              </div>
            </div>
            <div>
              <strong>⚠️ Attention Flags:</strong>
              <div style={{ marginTop: "8px", fontSize: "11px" }}>
                Shows when transfer is stuck (old + no progress) or failed
              </div>
            </div>
            <div>
              <strong>Settlement Distinction:</strong>
              <div style={{ marginTop: "8px", fontSize: "11px" }}>
                🟦 Crypto = Blockchain confirmation (on-chain hash)
              </div>
              <div style={{ marginTop: "4px", fontSize: "11px" }}>
                🟧 Fiat = Payment provider confirmation (PSP webhook)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
