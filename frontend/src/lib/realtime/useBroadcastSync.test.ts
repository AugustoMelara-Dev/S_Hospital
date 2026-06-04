import { beforeEach, describe, expect, it } from 'vitest';
import { setStoredUserId } from './session';
import { __test__isOwnEvent, __test__shouldNotifyBroadcast } from './useBroadcastSync';

describe('isOwnEvent', () => {
  beforeEach(() => {
    setStoredUserId(null);
  });

  it('returns false when actorId is missing', () => {
    expect(__test__isOwnEvent(undefined, 1)).toBe(false);
    expect(__test__isOwnEvent(null, 1)).toBe(false);
  });

  it('returns false when no user is logged in', () => {
    expect(__test__isOwnEvent(5, null)).toBe(false);
  });

  it('returns true when actorId matches the current user', () => {
    expect(__test__isOwnEvent(7, 7)).toBe(true);
  });

  it('returns false when actorId differs from the current user', () => {
    expect(__test__isOwnEvent(7, 8)).toBe(false);
  });

  it('suppresses notifications for the current user at event time', () => {
    setStoredUserId(7);
    expect(__test__shouldNotifyBroadcast(7)).toBe(false);
    expect(__test__shouldNotifyBroadcast(8)).toBe(true);

    setStoredUserId(8);
    expect(__test__shouldNotifyBroadcast(7)).toBe(true);
    expect(__test__shouldNotifyBroadcast(8)).toBe(false);
  });

  it('keeps notifications for legacy events without actor id', () => {
    setStoredUserId(7);
    expect(__test__shouldNotifyBroadcast(undefined)).toBe(true);
    expect(__test__shouldNotifyBroadcast(null)).toBe(true);
  });
});
