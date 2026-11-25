'use client';

import React, { useEffect, useState } from 'react';
import { listCctpTransfers, CctpTransfer, type TransferDetailResponse } from '@/lib/services/cctp-api';
import { getCctpTransferDetail } from '@/lib/services/cctp-api';
import ActivityList, { ActivityItem } from '@/components/ui/ActivityList';
import CctpDetailModal from './CctpDetailModal';

export default function CctpTransfersScreen() {
  const [transfers, setTransfers] = useState<CctpTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });

  useEffect(() => {
    const loadTransfers = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listCctpTransfers({
          limit: 50,
          offset: pagination.offset,
          min_age_minutes: 0,
        });
        setTransfers(data.transfers || []);
        setPagination(data.pagination || { limit: 50, offset: 0, total: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transfers');
        console.error('Error loading transfers:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTransfers();
  }, [pagination.offset]);

  const getStatusBadgeColor = (transfer: CctpTransfer): string => {
    if (transfer.stuck) return '#c62828';
    if (transfer.status === 'completed') return '#1a8a4a';
    return '#b47700';
  };

  const getStatusLabel = (transfer: CctpTransfer): string => {
    if (transfer.stuck) return 'Stuck';
    const labels: Record<string, string> = {
      detected: 'Deposit Detected',
      burning: 'Burn Submitted',
      burned: 'Burn Confirmed',
      attesting: 'Circle Attestation',
      minting: 'Destination Mint',
      completed: 'Completed',
      failed: 'Failed',
    };
    return labels[transfer.status] || transfer.status;
  };

  const getElapsedTime = (createdAt: string): string => {
    const created = new Date(createdAt);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - created.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const activityItems: ActivityItem[] = transfers.map((tx) => ({
    id: tx.id,
    client: `${tx.source_chain.toUpperCase()} → ${tx.dest_chain.toUpperCase()}`,
    type: 'CCTP Transfer',
    amount: `$${tx.amount_usdc}`,
    amountColor: undefined,
    statusLabel: getStatusLabel(tx),
    statusColor: getStatusBadgeColor(tx),
    statusSoft: '#f0f0f0',
    dateLabel: getElapsedTime(tx.created_at),
    meta: tx.stuck ? '⚠️ Needs attention' : undefined,
    openDetail: () => setSelectedId(tx.id),
  }));

  return (
    <>
      <div className="ep-txn-screen">
        {loading && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
            Loading CCTP transfers…
          </div>
        )}

        {error && (
          <div style={{ padding: '16px', backgroundColor: 'rgba(197, 40, 40, 0.08)', borderRadius: '12px', color: '#c62828', fontSize: '13px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <ActivityList
              title="CCTP Transfers"
              items={activityItems}
              emptyLabel="No CCTP transfers yet"
              columns="transactions"
              showHeader={true}
            />

            {/* Pagination */}
            {!loading && transfers.length > 0 && (
              <nav className="ep-txn-pager" aria-label="Transfer pages">
                <span className="ep-txn-pager__meta" aria-live="polite">
                  Page {Math.floor(pagination.offset / pagination.limit) + 1} of {Math.ceil(pagination.total / pagination.limit)}
                  {pagination.total > 0 ? ` · ${pagination.total} total` : ''}
                </span>
                <div className="ep-txn-pager__actions">
                  <button
                    type="button"
                    onClick={() => setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                    disabled={pagination.offset === 0}
                    className="ep-txn-pager__btn"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagination((p) => ({ ...p, offset: p.offset + p.limit }))}
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                    className={`ep-txn-pager__btn${pagination.offset + pagination.limit < pagination.total ? ' ep-txn-pager__btn--primary' : ''}`}
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>

      {/* Modal Overlay */}
      {selectedId !== null && (
        <div
          className="ep-modal"
          onClick={() => setSelectedId(null)}
        />
      )}

      {/* Detail Modal */}
      {selectedId !== null && (
        <CctpDetailModal
          transferId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
