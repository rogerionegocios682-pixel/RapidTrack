/**
 * Web Push Notification Service for Delivery OS
 * Manages browser push permission and triggers system notifications with audio
 */

import { soundNotification } from './soundNotification';

class PushNotificationService {
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      console.warn('Error requesting push permission:', e);
      return false;
    }
  }

  public showNotification(
    title: string,
    body: string,
    type: 'new_order' | 'pending_delay' | 'order_completed' | 'order_canceled' | 'shift_closed' = 'new_order',
    tag?: string
  ): void {
    // 1. Play synthesized audio feedback
    if (type === 'new_order') {
      soundNotification.playNewOrderChime();
    } else if (type === 'pending_delay') {
      soundNotification.playPendingDelayBeep();
    } else if (type === 'order_completed') {
      soundNotification.playCompletedChime();
    }

    // 2. Display System Push Notification if permission granted
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: tag || `delivery_os_${Date.now()}`,
          badge: '/favicon.ico',
          requireInteraction: type === 'pending_delay',
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        console.warn('Native notification display error:', e);
      }
    }
  }
}

export const pushNotification = new PushNotificationService();
