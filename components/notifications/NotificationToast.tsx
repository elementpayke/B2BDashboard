'use client';

import React, { useEffect, useState } from 'react';
import { Notification, getNotificationIcon, getNotificationColor, getNotificationBgColor } from '@/lib/services/notifications';

interface NotificationToastProps {
  notification: Notification;
  onDismiss: () => void;
  autoClose?: number; // milliseconds
}

export default function NotificationToast({
  notification,
  onDismiss,
  autoClose = 5000,
}: NotificationToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onDismiss, 300);
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onDismiss]);

  return (
    <div
      className={`ep-notification-toast ${isExiting ? 'ep-notification-toast--exit' : ''}`}
      style={{
        backgroundColor: getNotificationBgColor(notification.type),
        borderLeftColor: getNotificationColor(notification.type),
      }}
    >
      <div className="ep-notification-toast__content">
        <div className="ep-notification-toast__icon">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="ep-notification-toast__text">
          <div className="ep-notification-toast__title">{notification.title}</div>
          <div className="ep-notification-toast__message">{notification.message}</div>
          {notification.amount && (
            <div className="ep-notification-toast__amount">
              <span className="ep-mono">{notification.amount} {notification.currency}</span>
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setIsExiting(true);
          setTimeout(onDismiss, 300);
        }}
        className="ep-notification-toast__close"
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}
