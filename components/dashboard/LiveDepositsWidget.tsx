'use client';

import React, { useState, useEffect } from 'react';

export interface LiveDeposit {
  id: string;
  amount: string;
  currency: string;
  source: string;
  sourceChain: string;
  status: 'pending' | 'confirmed';
  timestamp: Date;
}

interface LiveDepositsWidgetProps {
  deposits: LiveDeposit[];
  onViewAll?: () => void;
}

export default function LiveDepositsWidget({ deposits, onViewAll }: LiveDepositsWidgetProps) {
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Add animation to new deposits
    deposits.forEach((deposit) => {
      if (!animatingIds.has(deposit.id)) {
        setAnimatingIds((prev) => new Set([...prev, deposit.id]));
        const timer = setTimeout(() => {
          setAnimatingIds((prev) => {
            const next = new Set(prev);
            next.delete(deposit.id);
            return next;
          });
        }, 2000);
        return () => clearTimeout(timer);
      }
    });
  }, [deposits, animatingIds]);

  if (deposits.length === 0) {
    return null;
  }

  const confirmedCount = deposits.filter((d) => d.status === 'confirmed').length;
  const pendingCount = deposits.filter((d) => d.status === 'pending').length;

  return (
    <div className="ep-live-deposits-widget ep-panel">
      <div className="ep-live-deposits-widget__header">
        <h3 className="ep-live-deposits-widget__title">
          📥 Incoming Deposits
        </h3>
        {pendingCount > 0 && (
          <div className="ep-live-deposits-widget__status">
            <span className="ep-live-deposits-widget__pulse" />
            {pendingCount} in progress
          </div>
        )}
      </div>

      <div className="ep-live-deposits-widget__list">
        {deposits.slice(0, 3).map((deposit) => (
          <div
            key={deposit.id}
            className={`ep-live-deposits-widget__item${animatingIds.has(deposit.id) ? ' ep-live-deposits-widget__item--new' : ''}`}
          >
            <div className="ep-live-deposits-widget__item-left">
              <div className={`ep-live-deposits-widget__item-icon ep-live-deposits-widget__item-icon--${deposit.status}`}>
                {deposit.status === 'confirmed' ? '✓' : '⏳'}
              </div>
              <div className="ep-live-deposits-widget__item-info">
                <div className="ep-live-deposits-widget__item-source">
                  {deposit.source} ({deposit.sourceChain.toUpperCase()})
                </div>
                <div className="ep-live-deposits-widget__item-time">
                  {deposit.status === 'confirmed' ? 'Confirmed' : 'Processing...'}
                </div>
              </div>
            </div>
            <div className="ep-live-deposits-widget__item-amount">
              <span className="ep-mono">{deposit.amount}</span>
              <span className="ep-live-deposits-widget__item-currency">
                {deposit.currency}
              </span>
            </div>
          </div>
        ))}
      </div>

      {deposits.length > 3 && (
        <div className="ep-live-deposits-widget__footer">
          <button
            type="button"
            onClick={onViewAll}
            className="ep-live-deposits-widget__view-all"
          >
            View all {deposits.length} deposits →
          </button>
        </div>
      )}
    </div>
  );
}
