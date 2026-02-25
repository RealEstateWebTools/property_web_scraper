import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateAdmin = vi.fn();
const mockResolveKV = vi.fn();
const mockInitUsersKV = vi.fn();
const mockListUserKeys = vi.fn();
const mockUpdateUserTier = vi.fn();
const mockRevokeApiKey = vi.fn();
const mockDeleteUser = vi.fn();

vi.mock('@lib/services/admin-auth.js', () => ({
  authenticateAdmin: mockAuthenticateAdmin,
}));

vi.mock('@lib/services/kv-resolver.js', () => ({
  resolveKV: mockResolveKV,
}));

vi.mock('@lib/services/api-key-service.js', () => ({
  initUsersKV: mockInitUsersKV,
  listUserKeys: mockListUserKeys,
  updateUserTier: mockUpdateUserTier,
  revokeApiKey: mockRevokeApiKey,
  deleteUser: mockDeleteUser,
}));

async function parseJson(response: Response): Promise<any> {
  return response.json();
}

describe('/admin/api/users route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdmin.mockReturnValue({ authorized: true });
    mockResolveKV.mockReturnValue(null);
    mockUpdateUserTier.mockResolvedValue(true);
  });

  it('GET does not expose user listing API', async () => {
    const { GET } = await import('../../src/pages/admin/api/users.js');

    const request = new Request('http://localhost:4323/admin/api/users');
    const response = await GET({ request, locals: {} } as any);

    expect(response.status).toBe(404);
    const body = await parseJson(response);
    expect(body.error).toBe('Not found');
    expect(mockAuthenticateAdmin).not.toHaveBeenCalled();
  });

  it('POST stays admin-protected', async () => {
    mockAuthenticateAdmin.mockReturnValue({ authorized: false, errorMessage: 'Invalid admin key' });

    const { POST } = await import('../../src/pages/admin/api/users.js');
    const request = new Request('http://localhost:4323/admin/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_tier', userId: 'uid-1', tier: 'pro' }),
    });

    const response = await POST({ request, locals: {} } as any);
    expect(response.status).toBe(401);
    const body = await parseJson(response);
    expect(body.error).toBe('Invalid admin key');
  });

  it('POST change_tier still works for authorized admin', async () => {
    const { POST } = await import('../../src/pages/admin/api/users.js');
    const request = new Request('http://localhost:4323/admin/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_tier', userId: 'uid-1', tier: 'pro' }),
    });

    const response = await POST({ request, locals: {} } as any);
    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(mockUpdateUserTier).toHaveBeenCalledWith('uid-1', 'pro');
  });
});
