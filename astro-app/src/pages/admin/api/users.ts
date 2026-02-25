import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { resolveKV } from '@lib/services/kv-resolver.js';
import {
  initUsersKV,
  listUsers as listKVUsers,
  listUserKeys,
  updateUserTier,
  revokeApiKey,
  deleteUser,
  type SubscriptionTier,
} from '@lib/services/api-key-service.js';

export const GET: APIRoute = async ({ request, locals }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const kv = resolveKV(locals);
    initUsersKV(kv);

    // Get users from KV (primary source for subscription/API key management)
    const kvUsers = await listKVUsers();

    // Count by tier and build user data
    const byTier: Record<SubscriptionTier, number> = {
      free: 0,
      starter: 0,
      pro: 0,
      enterprise: 0,
    };

    const usersData = await Promise.all(
      kvUsers.map(async (u) => {
        byTier[u.tier]++;
        const keys = await listUserKeys(u.userId);
        const activeKeyCount = keys.filter((k) => k.active).length;
        return {
          userId: u.userId,
          email: u.email,
          name: u.name || null,
          tier: u.tier,
          keyCount: u.keyHashes.length,
          activeKeyCount,
          createdAt: u.createdAt,
          stripeCustomerId: u.stripeCustomerId || null,
        };
      }),
    );

    return new Response(
      JSON.stringify({
        total: firebaseUsers.length,
        byTier,
        users: usersData,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const kv = resolveKV(locals);
    initUsersKV(kv);

    const body = await request.json();
    const { action, userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'change_tier') {
      const { tier } = body;
      if (!['free', 'starter', 'pro', 'enterprise'].includes(tier)) {
        return new Response(JSON.stringify({ error: 'Invalid tier' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const success = await updateUserTier(userId, tier);
      if (!success) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, message: 'Tier updated' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list_keys') {
      const keys = await listUserKeys(userId);
      return new Response(
        JSON.stringify({
          userId,
          keys: keys.map((k) => ({
            prefix: k.prefix,
            label: k.label,
            active: k.active,
            createdAt: k.createdAt,
            hash: k.hash,
          })),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'revoke_key') {
      const { keyHash } = body;
      if (!keyHash) {
        return new Response(JSON.stringify({ error: 'Missing keyHash' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const success = await revokeApiKey(keyHash);
      if (!success) {
        return new Response(JSON.stringify({ error: 'Key not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, message: 'Key revoked' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete_user') {
      const success = await deleteUser(userId);
      if (!success) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, message: 'User deleted' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
