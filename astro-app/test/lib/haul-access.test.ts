import { describe, it, expect } from 'vitest';
import {
  canAccessHaul,
  canModifyHaul,
  isAuthenticatedUser,
  resolveHaulVisibility,
  userIdFromAuth,
} from '../../src/lib/services/haul-access.js';

describe('haul access rules', () => {
  it('treats missing visibility as public', () => {
    expect(resolveHaulVisibility({ visibility: undefined })).toBe('public');
  });

  it('allows anyone to access and edit public hauls', () => {
    const publicHaul = { visibility: 'public' as const, ownerUserId: undefined };
    expect(canAccessHaul(publicHaul)).toBe(true);
    expect(canModifyHaul(publicHaul, 'anonymous')).toBe(true);
    expect(canModifyHaul(publicHaul, 'user-123')).toBe(true);
  });

  it('restricts private hauls to the owner', () => {
    const privateHaul = { visibility: 'private' as const, ownerUserId: 'user-123' };
    expect(canAccessHaul(privateHaul)).toBe(false);
    expect(canAccessHaul(privateHaul, 'anonymous')).toBe(false);
    expect(canAccessHaul(privateHaul, 'user-999')).toBe(false);
    expect(canAccessHaul(privateHaul, 'user-123')).toBe(true);
  });

  it('extracts user identity from auth result', () => {
    expect(userIdFromAuth({ authorized: false, userId: 'user-123' })).toBeUndefined();
    expect(userIdFromAuth({ authorized: true, userId: 'user-123' })).toBe('user-123');
    expect(isAuthenticatedUser({ authorized: true, userId: 'anonymous' })).toBe(false);
    expect(isAuthenticatedUser({ authorized: true, userId: 'user-123' })).toBe(true);
  });
});
