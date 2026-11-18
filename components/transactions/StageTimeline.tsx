'use client';

import React from 'react';
import { Stage } from '@/lib/services/cctp-api';
import { ChainIcon } from './ChainIcons';

interface StageTimelineProps {
  stages: Stage[];
}

export default function StageTimeline({ stages }: StageTimelineProps) {
  return (
    <div className="ep-txn-timeline">
      <h3 className="ep-txn-timeline__title">Settlement Progress</h3>
      <div className="ep-txn-timeline__track">
        {stages.map((stage, index) => (
          <div key={index} className={`ep-txn-timeline__stage${index < stages.length - 1 ? ' ep-txn-timeline__stage--has-next' : ''}`}>
            {/* Timeline dot */}
            <div className="ep-txn-timeline__dot" />
            {/* Timeline line */}
            {index < stages.length - 1 && <div className="ep-txn-timeline__line" />}

            {/* Stage content */}
            <div className="ep-txn-timeline__content">
              <div className="ep-txn-timeline__stage-name">
                <ChainIcon chain={stage.chain} size={24} />
                {stage.stage}
              </div>
              <div className="ep-txn-timeline__stage-info">
                <strong>{stage.chain.toUpperCase()}</strong> • Payer: <strong className="ep-txn-timeline__payer">{stage.payer.slice(0, 6)}…{stage.payer.slice(-4)}</strong>
              </div>
              {stage.tx_hash ? (
                <div className="ep-txn-timeline__hash-row">
                  {stage.explorer_url ? (
                    <a
                      href={stage.explorer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ep-txn-timeline__hash-link"
                      title={stage.tx_hash}
                    >
                      <code className="ep-txn-timeline__hash">
                        {stage.tx_hash.slice(0, 8)}…{stage.tx_hash.slice(-8)}
                      </code>
                      <span className="ep-txn-timeline__link-icon">↗</span>
                    </a>
                  ) : (
                    <code className="ep-txn-timeline__hash">
                      {stage.tx_hash.slice(0, 8)}…{stage.tx_hash.slice(-8)}
                    </code>
                  )}
                </div>
              ) : (
                <div className="ep-txn-timeline__pending">
                  ⏳ Waiting for transaction…
                </div>
              )}
              {stage.fee && (
                <div className="ep-txn-timeline__gas">
                  <span className="ep-txn-timeline__gas-label">On-chain fee:</span>
                  <span className="ep-mono">{stage.fee.gas_native} {stage.fee.unit}</span>
                  {stage.fee.gas_usd && <span className="ep-txn-timeline__gas-usd">${stage.fee.gas_usd}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
