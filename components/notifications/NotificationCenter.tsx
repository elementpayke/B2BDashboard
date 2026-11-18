'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Notification, getNotificationIcon, getNotificationColor, getNotificationBgColor, formatNotificationTime } from '@/lib/services/notifications';

interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount: number;
  onNotificationClick?: (notification: Notification) => void;
}

export default function NotificationCenter({
  notifications,
  unreadCount,
  onNotificationClick,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="ep-notification-center">
      <button
        type="button"
        className="ep-notification-center__bell"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-pressed={isOpen}
      >
        <span className="ep-notification-center__icon">🔔</span>
        {unreadCount > 0 && (
          <span className="ep-notification-center__badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="ep-notification-center__dropdown">
          <div className="ep-notification-center__header">
            <h3 className="ep-notification-center__title">Notifications</h3>
            {unreadCount > 0 && (
              <span className="ep-notification-center__unread">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="ep-notification-center__list">
            {notifications.length === 0 ? (
              <div className="ep-notification-center__empty">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`ep-notification-center__item${!notification.read ? ' ep-notification-center__item--unread' : ''}`}
                  onClick={() => {
                    onNotificationClick?.(notification);
                    setIsOpen(false);
                  }}
                  style={{
                    backgroundColor: getNotificationBgColor(notification.type),
                    borderLeftColor: getNotificationColor(notification.type),
                  }}
                >
                  <div className="ep-notification-center__item-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="ep-notification-center__item-content">
                    <div className="ep-notification-center__item-title">
                      {notification.title}
                    </div>
                    <div className="ep-notification-center__item-message">
                      {notification.message}
                    </div>
                    {notification.amount && (
                      <div className="ep-notification-center__item-amount">
                        <span className="ep-mono">
                          {notification.amount} {notification.currency}
                        </span>
                      </div>
                    )}
                    <div className="ep-notification-center__item-time">
                      {formatNotificationTime(notification.timestamp)}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="ep-notification-center__item-dot" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="ep-notification-center__footer">
            <button type="button" className="ep-notification-center__view-all">
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
