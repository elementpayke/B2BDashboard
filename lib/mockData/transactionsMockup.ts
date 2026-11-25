/**
 * Mock transaction data for UI mockup
 * Shows various CCTP transfer states for demonstration
 */

export const mockTransactions = [
  // Active: Recently created, detecting
  {
    id: 1001,
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    status: "processing",
    stage: "detected",
    source_chain: "base",
    dest_chain: "stellar",
    amount_usdc: "1000.00",
    amount_raw: "1000000000",
    source_tx_hash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    burn_tx_hash: null,
    mint_tx_hash: null,
    created_ago_minutes: 2,
    stuck: false,
    fee_usdc: null,
    source_log_index: 42,
    source: "cctp_transfer",
    nuvion_account_id: null,
  },
  // Active: Burn submitted, waiting for Circle attestation
  {
    id: 1002,
    created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    status: "processing",
    stage: "attesting",
    source_chain: "base",
    dest_chain: "stellar",
    amount_usdc: "2500.00",
    amount_raw: "2500000000",
    source_tx_hash: "0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
    burn_tx_hash: "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d",
    mint_tx_hash: null,
    created_ago_minutes: 8,
    stuck: false,
    fee_usdc: "0.50",
    source_log_index: 43,
    source: "cctp_transfer",
    attesting_wait_seconds: 120,
  },
  // Active: Minting on destination
  {
    id: 1003,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: "processing",
    stage: "minting",
    source_chain: "base",
    dest_chain: "stellar",
    amount_usdc: "500.00",
    amount_raw: "500000000",
    source_tx_hash: "0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e",
    burn_tx_hash: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f",
    mint_tx_hash: "0x6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a",
    created_ago_minutes: 15,
    stuck: false,
    fee_usdc: "0.50",
    source_log_index: 44,
    source: "cctp_transfer",
  },
  // Completed: Fully settled
  {
    id: 1004,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: "completed",
    stage: "credited",
    source_chain: "base",
    dest_chain: "stellar",
    amount_usdc: "10000.00",
    amount_raw: "10000000000",
    source_tx_hash: "0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
    burn_tx_hash: "0x8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c",
    mint_tx_hash: "0x9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
    created_ago_minutes: 45,
    stuck: false,
    fee_usdc: "1.00",
    source_log_index: 45,
    source: "cctp_transfer",
  },
  // Stuck: Old transfer not advancing
  {
    id: 1005,
    created_at: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
    status: "processing",
    stage: "attesting",
    source_chain: "base",
    dest_chain: "stellar",
    amount_usdc: "750.00",
    amount_raw: "750000000",
    source_tx_hash: "0x0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e",
    burn_tx_hash: "0x1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f",
    mint_tx_hash: null,
    created_ago_minutes: 65,
    stuck: true,
    fee_usdc: "0.50",
    source_log_index: 46,
    source: "cctp_transfer",
    error: "Circle attestation timeout",
  },
  // Failed: Error occurred
  {
    id: 1006,
    created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    status: "failed",
    stage: "burning",
    source_chain: "base",
    dest_chain: "stellar",
    amount_usdc: "2000.00",
    amount_raw: "2000000000",
    source_tx_hash: "0x2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a",
    burn_tx_hash: null,
    mint_tx_hash: null,
    created_ago_minutes: 120,
    stuck: false,
    fee_usdc: null,
    source_log_index: 47,
    source: "cctp_transfer",
    error: "Insufficient gas sponsor balance on Base",
  },
];

export function getMockTransactionWithDetail(id: number) {
  const tx = mockTransactions.find((t) => t.id === id);
  if (!tx) return null;

  // Enhanced detail with stages, settlement info, webhook status
  return {
    ...tx,
    stages: [
      {
        stage: "deposit",
        chain: "base",
        tx_hash: tx.source_tx_hash,
        payer: "customer",
        explorer_url: `https://basescan.org/tx/${tx.source_tx_hash}`,
        fee: { gas_native: "0.0012", unit: "ETH", gas_usd: 0.45 },
        completed_at: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
      },
      tx.burn_tx_hash
        ? {
            stage: "burn",
            chain: tx.source_chain,
            tx_hash: tx.burn_tx_hash,
            payer: "element_sponsor",
            explorer_url: `https://basescan.org/tx/${tx.burn_tx_hash}`,
            fee: { gas_native: "0.0018", unit: "ETH", gas_usd: 0.67 },
            completed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          }
        : null,
      tx.mint_tx_hash
        ? {
            stage: "mint",
            chain: "stellar",
            tx_hash: tx.mint_tx_hash,
            payer: "circle_sponsor",
            explorer_url: `https://stellar.expert/explorer/public/tx/${tx.mint_tx_hash}`,
            fee: { gas_native: "0.00001", unit: "XLM", gas_usd: 0.0001 },
            completed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          }
        : null,
    ].filter(Boolean),

    // Settlement distinction
    crypto_settlement: tx.mint_tx_hash
      ? {
          confirmed: true,
          tx_hash: tx.mint_tx_hash,
          time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        }
      : {
          confirmed: false,
          status: tx.status === "failed" ? "failed" : "pending",
        },

    fiat_settlement: {
      confirmed: false,
      status: "awaiting_provider",
      psp_name: "swipelux",
      message: "Waiting for payment provider confirmation",
    },

    // Webhook delivery status
    webhook_delivery: {
      status: "pending",
      attempts: 0,
      last_http_status: null,
      error: null,
      next_attempt_at: null,
    },

    // Fees breakdown
    circle_fee_usdc: tx.fee_usdc || "0.00",
    total_element_gas_usd: 1.12,
  };
}

export function computeTransactionDisplay(tx: any) {
  const createdAt = new Date(tx.created_at);
  const now = new Date();
  const elapsedMs = now.getTime() - createdAt.getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  const stageLabels: Record<string, string> = {
    detected: "Deposit Detected",
    burning: "Burn Submitted",
    attesting: "Circle Attestation",
    minting: "Destination Mint",
    credited: "Funds Landed",
  };

  const nextActionLabels: Record<string, string> = {
    detected: "Burn transaction",
    burning: "Circle attestation",
    attesting: "Destination mint",
    minting: "Chain confirmation",
    credited: "Payment provider",
  };

  const stageColor: Record<string, string> = {
    detected: "bg-yellow-100 text-yellow-800",
    burning: "bg-blue-100 text-blue-800",
    attesting: "bg-blue-100 text-blue-800",
    minting: "bg-blue-100 text-blue-800",
    credited: "bg-green-100 text-green-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  return {
    currentStage: stageLabels[tx.stage] || tx.stage,
    elapsedSeconds,
    elapsedMinutes,
    elapsedDisplay:
      elapsedMinutes < 1
        ? `${elapsedSeconds}s`
        : elapsedMinutes < 60
          ? `${elapsedMinutes}m`
          : `${Math.floor(elapsedMinutes / 60)}h`,
    nextAction: `Waiting for ${nextActionLabels[tx.stage] || "settlement"}`,
    needsAttention: tx.status === "failed" || tx.stuck,
    stageColor: stageColor[tx.status] || stageColor[tx.stage] || "bg-gray-100 text-gray-800",
  };
}
