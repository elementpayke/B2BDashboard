"use client";

import PayoutBatchWizard from "@/components/wallets/PayoutBatchWizard";
import type { FinancialAccount } from "@/lib/services/entities";

const MOCK_ACCOUNTS: FinancialAccount[] = [
  {
    id: "17",
    entityId: "pcus_dev",
    assetType: "stablecoin",
    currency: "USDC",
    network: "Stellar",
    status: "active",
  },
];

/**
 * Local visual sandbox for the mixed-rail bulk payout wizard.
 * Not linked from product nav — only hit this URL while developing.
 */
export default function DevBulkWizardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg, #f4f3f8)",
        padding: "32px 16px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="ep-modal ep-modal--expanded"
        style={{
          position: "relative",
          width: "min(720px, 100%)",
          maxHeight: "92vh",
          overflow: "auto",
          margin: 0,
        }}
      >
        <div className="ep-modal__header">
          <h3 className="ep-modal__title">Bulk payouts (dev preview)</h3>
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <PayoutBatchWizard
            sourceAccounts={MOCK_ACCOUNTS}
            onDone={() => undefined}
            onCancel={() => undefined}
          />
        </div>
      </div>
    </main>
  );
}
