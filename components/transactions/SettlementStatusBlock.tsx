'use client';

import React from 'react';

interface SettlementStatus {
  confirmed: boolean;
  status?: string;
  tx_hash?: string;
  message?: string;
  psp_name?: string;
}

interface SettlementStatusBlockProps {
  cryptoSettlement: SettlementStatus;
  fiatSettlement: SettlementStatus;
}

export default function SettlementStatusBlock({ cryptoSettlement, fiatSettlement }: SettlementStatusBlockProps) {
  return (
    <div className="ep-txn-settlement">
      {/* Crypto Settlement */}
      <div className="ep-txn-settlement__box ep-txn-settlement__box--crypto">
        <h4 className="ep-txn-settlement__title">🔗 Crypto Settlement</h4>
        {cryptoSettlement.confirmed ? (
          <div>
            <div className="ep-txn-settlement__status ep-txn-settlement__status--confirmed">
              ✓ Confirmed on-chain
            </div>
            {cryptoSettlement.tx_hash && (
              <div className="ep-mono ep-txn-settlement__hash">
                {cryptoSettlement.tx_hash.slice(0, 16)}…{cryptoSettlement.tx_hash.slice(-16)}
              </div>
            )}
          </div>
        ) : (
          <div className={`ep-txn-settlement__status${cryptoSettlement.status === 'failed' ? ' ep-txn-settlement__status--failed' : ' ep-txn-settlement__status--pending'}`}>
            {cryptoSettlement.status === 'failed' ? '❌ Failed' : '⏳ Pending blockchain confirmation'}
          </div>
        )}
      </div>

      {/* Fiat Settlement */}
      <div className="ep-txn-settlement__box ep-txn-settlement__box--fiat">
        <h4 className="ep-txn-settlement__title">💳 Fiat Settlement</h4>
        {fiatSettlement.confirmed ? (
          <div>
            <div className="ep-txn-settlement__status ep-txn-settlement__status--confirmed">
              ✓ Received by payment provider
            </div>
            {fiatSettlement.psp_name && (
              <div className="ep-txn-settlement__psp">
                Provider: {fiatSettlement.psp_name}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="ep-txn-settlement__status ep-txn-settlement__status--pending">
              ⏳ {fiatSettlement.message || 'Awaiting provider confirmation'}
            </div>
            {fiatSettlement.psp_name && (
              <div className="ep-txn-settlement__psp">
                ({fiatSettlement.psp_name})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
