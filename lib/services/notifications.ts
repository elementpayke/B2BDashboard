/**
 * Notification service for real-time transaction updates
 * Handles deposits, transfers, and transaction status changes
 */

export type NotificationType = 'deposit' | 'transfer' | 'success' | 'failed' | 'stuck';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  amount?: string;
  currency?: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

// Mock notifications for demo
export function getMockNotifications(): Notification[] {
  const now = new Date();
  return [
    {
      id: '1',
      type: 'deposit',
      title: 'Deposit Received',
      message: 'Incoming deposit from Base chain',
      amount: '1,000',
      currency: 'USDC',
      timestamp: new Date(now.getTime() - 2 * 60000),
      read: false,
    },
    {
      id: '2',
      type: 'success',
      title: 'Transfer Complete',
      message: 'CCTP transfer to Stellar completed successfully',
      amount: '500',
      currency: 'USDC',
      timestamp: new Date(now.getTime() - 5 * 60000),
      read: false,
    },
    {
      id: '3',
      type: 'transfer',
      title: 'Transfer In Progress',
      message: 'Cross-chain transfer is being processed',
      amount: '250',
      currency: 'USDC',
      timestamp: new Date(now.getTime() - 10 * 60000),
      read: true,
    },
    {
      id: '4',
      type: 'failed',
      title: 'Transfer Failed',
      message: 'Payment processing failed - insufficient balance',
      amount: '100',
      currency: 'USD',
      timestamp: new Date(now.getTime() - 1 * 3600000),
      read: true,
    },
  ];
}

export function getNotificationColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    deposit: '#1a8a4a',      // Green
    transfer: '#3b2ed3',       // Indigo
    success: '#1a8a4a',        // Green
    failed: '#c62828',         // Red
    stuck: '#b47700',          // Amber
  };
  return colors[type];
}

export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    deposit: '📥',
    transfer: '🔄',
    success: '✓',
    failed: '✕',
    stuck: '⚠️',
  };
  return icons[type];
}

export function getNotificationBgColor(type: NotificationType): string {
  const bgColors: Record<NotificationType, string> = {
    deposit: '#e8f5e9',
    transfer: '#eeedfb',
    success: '#e8f5e9',
    failed: '#ffebee',
    stuck: '#fff3e0',
  };
  return bgColors[type];
}

export function formatNotificationTime(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}
