'use client';

import React, { useState, useEffect } from 'react';
import NotificationToast from '@/components/notifications/NotificationToast';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import LiveDepositsWidget from '@/components/dashboard/LiveDepositsWidget';
import CctpTransfersScreen from '@/components/transactions/CctpTransfersScreen';
import { Notification, getMockNotifications } from '@/lib/services/notifications';
import { LiveDeposit } from '@/components/dashboard/LiveDepositsWidget';

/**
 * Enhanced Dashboard Layout with:
 * - Real-time notifications & alerts
 * - Live deposit visibility
 * - CCTP transfer tracking
 * - Transaction status monitoring
 */

export default function EnhancedDashboardLayout() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastNotifications, setToastNotifications] = useState<Notification[]>([]);
  const [liveDeposits, setLiveDeposits] = useState<LiveDeposit[]>([]);
  const [showCctpTab, setShowCctpTab] = useState(false);

  // Initialize notifications
  useEffect(() => {
    const mockNotifications = getMockNotifications();
    setNotifications(mockNotifications);
  }, []);

  // Simulate incoming deposits (real-time)
  useEffect(() => {
    const timer = setInterval(() => {
      const newDeposit: LiveDeposit = {
        id: Date.now().toString(),
        amount: Math.floor(Math.random() * 5000 + 500).toString(),
        currency: 'USDC',
        source: `External Wallet ${Math.floor(Math.random() * 100)}`,
        sourceChain: ['base', 'polygon', 'ethereum'][Math.floor(Math.random() * 3)],
        status: Math.random() > 0.3 ? 'confirmed' : 'pending',
        timestamp: new Date(),
      };

      setLiveDeposits((prev) => [newDeposit, ...prev.slice(0, 4)]);

      // Add toast notification for confirmed deposits
      if (newDeposit.status === 'confirmed') {
        const notification: Notification = {
          id: newDeposit.id,
          type: 'deposit',
          title: 'Deposit Confirmed',
          message: `${newDeposit.amount} ${newDeposit.currency} from ${newDeposit.source}`,
          amount: newDeposit.amount,
          currency: newDeposit.currency,
          timestamp: new Date(),
          read: false,
        };
        setToastNotifications((prev) => [notification, ...prev.slice(0, 2)]);

        // Auto remove after 5 seconds
        setTimeout(() => {
          setToastNotifications((prev) => prev.filter((n) => n.id !== notification.id));
        }, 5000);
      }
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="ep-enhanced-dashboard">
      {/* Header with Notification Center */}
      <div className="ep-enhanced-dashboard__header">
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Dashboard</h1>
        <div className="ep-enhanced-dashboard__controls">
          <NotificationCenter
            notifications={notifications}
            unreadCount={unreadCount}
            onNotificationClick={(notification) => {
              setNotifications((prev) =>
                prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
              );
            }}
          />
        </div>
      </div>

      {/* Toast Notifications Stack */}
      <div className="ep-notification-stack">
        {toastNotifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() =>
              setToastNotifications((prev) => prev.filter((n) => n.id !== notification.id))
            }
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="ep-enhanced-dashboard__content">
        {/* Live Deposits Widget - Prominent positioning */}
        {liveDeposits.length > 0 && (
          <LiveDepositsWidget
            deposits={liveDeposits}
            onViewAll={() => setShowCctpTab(false)}
          />
        )}

        {/* Tabs for different views */}
        <div className="ep-enhanced-dashboard__tabs">
          <button
            type="button"
            className={`ep-enhanced-dashboard__tab${!showCctpTab ? ' ep-enhanced-dashboard__tab--active' : ''}`}
            onClick={() => setShowCctpTab(false)}
          >
            📊 Activity & Deposits
          </button>
          <button
            type="button"
            className={`ep-enhanced-dashboard__tab${showCctpTab ? ' ep-enhanced-dashboard__tab--active' : ''}`}
            onClick={() => setShowCctpTab(true)}
          >
            🔗 CCTP Transfers
          </button>
        </div>

        {/* CCTP Transfers Tab */}
        {showCctpTab ? (
          <div className="ep-panel">
            <CctpTransfersScreen />
          </div>
        ) : (
          <div className="ep-panel">
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
              <p>Regular transactions and activity view would appear here</p>
              <p style={{ fontSize: '12px', marginTop: '16px' }}>
                Use the notifications above to track real-time updates on deposits and transfers
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
