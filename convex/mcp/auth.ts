import type { ActionCtx } from '../_generated/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export type AuthInfo = {
  sub: string;          // github_id (string)
  username: string;
  services: string[];
  client_id: string;
};

// Lazily initialized — cached for the lifetime of the isolate.
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!_jwks) {
    const issuer = process.env.IDENTITY_ISSUER;
    if (!issuer) throw new Error('IDENTITY_ISSUER environment variable not set');
    _jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return _jwks;
}

export async function extractAuth(_ctx: ActionCtx, request: Request): Promise<AuthInfo> {
  const header = request.headers.get('Authorization');
  if (!header) throw new Error('Missing Authorization header');

  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new Error('Invalid Authorization header format');

  const issuer = process.env.IDENTITY_ISSUER!;
  const { payload } = await jwtVerify(match[1], getJwks(), {
    issuer,
    audience: issuer,
  });

  if (!payload.sub) throw new Error('Token missing sub claim');

  const services = Array.isArray(payload['services']) ? payload['services'] as string[] : [];
  if (!services.includes('trellis')) {
    throw new Error('Token does not grant access to this service');
  }

  return {
    sub: payload.sub,
    username: payload['username'] as string ?? '',
    services,
    client_id: payload['client_id'] as string ?? '',
  };
}
