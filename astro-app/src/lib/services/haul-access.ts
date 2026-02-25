import type { AuthResult } from './auth.js';
import type { Haul } from './haul-store.js';

export function resolveHaulVisibility(haul: Pick<Haul, 'visibility'>): 'public' | 'private' {
  return haul.visibility === 'private' ? 'private' : 'public';
}

export function isPrivateHaul(haul: Pick<Haul, 'visibility'>): boolean {
  return resolveHaulVisibility(haul) === 'private';
}

export function userIdFromAuth(auth: Pick<AuthResult, 'authorized' | 'userId'>): string | undefined {
  return auth.authorized ? auth.userId : undefined;
}

export function isAuthenticatedUser(auth: Pick<AuthResult, 'authorized' | 'userId'>): boolean {
  const userId = userIdFromAuth(auth);
  return Boolean(userId && userId !== 'anonymous');
}

export function canAccessHaul(
  haul: Pick<Haul, 'visibility' | 'ownerUserId'>,
  userId?: string,
): boolean {
  if (!isPrivateHaul(haul)) return true;
  if (!userId || userId === 'anonymous') return false;
  return haul.ownerUserId === userId;
}

export function canModifyHaul(
  haul: Pick<Haul, 'visibility' | 'ownerUserId'>,
  userId?: string,
): boolean {
  return canAccessHaul(haul, userId);
}
