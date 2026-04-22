/**
 * Decode the JWT payload (middle segment) without verifying signature.
 *
 * This is intentionally "best effort" for UI convenience only (role/tenant hints, debug).
 * Do NOT use this for security decisions — the server remains the source of truth.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function roleFromToken(token: string | null): string | undefined {
  if (!token) return undefined;
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  return typeof role === 'string' ? role : undefined;
}

export function tenantIdFromToken(token: string | null): string | null | undefined {
  if (!token) return undefined;
  const payload = decodeJwtPayload(token);
  const tid = payload?.tenant_id;
  if (tid === null) return null;
  if (typeof tid === 'string') return tid;
  return undefined;
}

/** JWT `sub` — same identifier as backend user id (UUID string). */
export function userIdFromAccessToken(token: string | null): string | undefined {
  if (!token) return undefined;
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  return typeof sub === 'string' ? sub : undefined;
}
