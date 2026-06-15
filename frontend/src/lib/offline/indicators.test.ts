import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  getOfflineMessage,
  isOfflineAvailable,
  getAllOfflineMessages,
  isNavigatorOffline,
  onOfflineChange,
  type OfflineFeature,
} from './indicators';

describe('offline indicators', () => {
  describe('getOfflineMessage', () => {
    it('returns a structured message for each known feature', () => {
      const features: OfflineFeature[] = [
        'realtime_sync',
        'remote_backup',
        'license_validation',
        'remote_support',
        'external_font',
        'cdn_asset',
        'remote_log',
      ];
      for (const f of features) {
        const msg = getOfflineMessage(f);
        expect(msg.title.length).toBeGreaterThan(0);
        expect(msg.description.length).toBeGreaterThan(0);
        expect(msg.hint.length).toBeGreaterThan(0);
      }
    });

    it('marks realtime_sync as available offline', () => {
      expect(isOfflineAvailable('realtime_sync')).toBe(true);
    });

    it('marks cdn_asset and external_font as not available offline', () => {
      expect(isOfflineAvailable('cdn_asset')).toBe(false);
      expect(isOfflineAvailable('external_font')).toBe(false);
      expect(isOfflineAvailable('remote_support')).toBe(false);
    });

    it('returns the same object reference for the same feature', () => {
      const a = getOfflineMessage('realtime_sync');
      const b = getOfflineMessage('realtime_sync');
      expect(a).toBe(b);
    });
  });

  describe('getAllOfflineMessages', () => {
    it('returns one message per feature', () => {
      const all = getAllOfflineMessages();
      expect(all.length).toBeGreaterThanOrEqual(7);
      const titles = new Set(all.map((m) => m.title));
      expect(titles.size).toBe(all.length);
    });
  });

  describe('isNavigatorOffline', () => {
    let originalOnLine: boolean;

    beforeEach(() => {
      originalOnLine = navigator.onLine;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: originalOnLine,
      });
    });

    it('returns true when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      expect(isNavigatorOffline()).toBe(true);
    });

    it('returns false when navigator.onLine is true', () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      expect(isNavigatorOffline()).toBe(false);
    });
  });

  describe('onOfflineChange', () => {
    it('registers a handler and returns an unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = onOfflineChange(handler);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });
});
