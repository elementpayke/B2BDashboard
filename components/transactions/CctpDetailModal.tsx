'use client';

import React, { useEffect, useState } from 'react';
import { getCctpTransferDetail, TransferDetailResponse } from '@/lib/services/cctp-api';
import StageTimeline from './StageTimeline';
import SettlementStatusBlock from './SettlementStatusBlock';

interface CctpDetailModalProps {
  transferId: number;
  onClose: () => void;
}

export default function CctpDetailModal({ transferId, onClose }: CctpDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TransferDetailResponse | null>(null);

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getCctpTransferDetail(transferId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transfer details');
        console.error('Error loading transfer detail:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [transferId]);

  if (loading) {
    return (
      <div className="ep-modal-overlay" onClick={onClose}>
        <div className="ep-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ep-modal__header">
            <h2 className="ep-modal__title">Loading…</h2>
            <button onClick={onClose} className="ep-modal__close" aria-label="Close">✕</button>
          </div>
          <div style={{ textAlign: 'center', padding: '48px 32px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '14px' }}>Loading transfer details…</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ep-modal-overlay" onClick={onClose}>
        <div className="ep-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ep-modal__header">
            <h2 className="ep-modal__title" style={{ color: '#c62828' }}>Error</h2>
            <button onClick={onClose} className="ep-modal__close" aria-label="Close">✕</button>
          </div>
          <div style={{ padding: '24px 20px', color: '#c62828', fontSize: '13px' }}>
            {error || 'Failed to load transfer details'}
          </div>
        </div>
      </div>
    );
  }

  const { transfer, stages } = data;

  return (
    <div className="ep-modal-overlay" onClick={onClose}>
      <div className="ep-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ep-modal__header">
          <h2 className="ep-modal__title">Transfer #{transfer.id}</h2>
          <button onClick={onClose} className="ep-modal__close" aria-label="Close">✕</button>
        </div>

        {/* Summary / Hero Section */}
        <div className="ep-txn-detail__hero">
          <div className="ep-txn-detail__amount ep-mono">${transfer.amount_usdc} USDC</div>
          <div className="ep-txn-detail__party">
            Received from <strong>{transfer.source_chain.toUpperCase()}</strong> → Bridging to <strong>{transfer.dest_chain.toUpperCase()}</strong>
          </div>
          <div className="ep-txn-detail__status">
            {transfer.stuck ? (
              <span className="ep-activity__badge ep-activity__badge--md" style={{ background: 'rgba(198, 40, 40, 0.12)', color: '#c62828', borderColor: 'rgba(198, 40, 40, 0.2)' }}>
                ⚠️ Stuck
              </span>
            ) : (
              <span className="ep-activity__badge ep-activity__badge--md">
                {transfer.status === 'completed' ? '✓' : '●'} {transfer.status}
              </span>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {transfer.error && (
          <div style={{
            padding: '12px 20px',
            background: 'rgba(198, 40, 40, 0.08)',
            borderBottom: '1px solid rgba(198, 40, 40, 0.15)',
            color: '#c62828',
            fontSize: '12px',
            lineHeight: '1.5',
          }}>
            <strong>⚠️ Error:</strong> {transfer.error}
          </div>
        )}

        {/* Stage Timeline */}
        <StageTimeline stages={stages} />

        {/* Settlement Status */}
        <SettlementStatusBlock
          cryptoSettlement={{
            confirmed: transfer.mint_tx_hash !== null,
            status: transfer.status === 'failed' ? 'failed' : 'pending',
            tx_hash: transfer.mint_tx_hash,
          }}
          fiatSettlement={{
            confirmed: false,
            status: 'awaiting_provider',
            message: 'Waiting for payment provider confirmation',
            psp_name: 'swipelux',
          }}
        />

        {/* Fee Breakdown */}
        <div className="ep-txn-detail__section">
          <h3 className="ep-txn-detail__section-title">Fees</h3>
          <div className="ep-txn-detail__row">
            <span className="ep-txn-detail__label">Circle On-Chain Fee</span>
            <span className="ep-txn-detail__value ep-mono">${transfer.fee_usdc || '0.00'} USDC</span>
          </div>
          <div className="ep-txn-detail__row">
            <span className="ep-txn-detail__label">Mboka Gas Sponsorship</span>
            <span className="ep-txn-detail__value ep-mono">${data.total_element_gas_usd || '0.00'} USD</span>
          </div>
        </div>

        {/* Timestamps */}
        <div className="ep-txn-detail__section">
          <h3 className="ep-txn-detail__section-title">Timing</h3>
          <div className="ep-txn-detail__row">
            <span className="ep-txn-detail__label">Received at:</span>
            <span className="ep-txn-detail__value">{new Date(transfer.created_at).toLocaleString()}</span>
          </div>
          <div className="ep-txn-detail__row">
            <span className="ep-txn-detail__label">Time elapsed:</span>
            <span className="ep-txn-detail__value">{transfer.age_minutes} minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
