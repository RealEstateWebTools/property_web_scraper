import type { APIRoute } from 'astro';
import { clearAdminCookie } from '@lib/services/admin-auth.js';

export const GET: APIRoute = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/admin/login',
      'Set-Cookie': clearAdminCookie(),
    },
  });
};
