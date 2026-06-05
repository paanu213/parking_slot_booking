import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import { Conflict, Unauthorized } from '../../lib/http.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const thirtyDaysFromNow = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

export const registerUser = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('Email already registered');

  const role = input.role ?? 'CUSTOMER';

  const user = await prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      role,
      ...(role === 'VENDOR' && {
        vendor: {
          create: {
            businessName: input.fullName,
            contactPhone: input.phone ?? '',
            address: '',
          },
        },
      }),
    },
  });

  return issueTokens(user);
};

export const loginUser = async ({ email, password }: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw Unauthorized('Invalid credentials');
  if (user.status !== 'ACTIVE') throw Unauthorized('Account not active');
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw Unauthorized('Invalid credentials');
  return issueTokens(user);
};

/**
 * Issue an access + refresh pair, persist the refresh token's hash,
 * and return them along with the user record (for DTO mapping).
 */
export const issueTokens = async (user: User) => {
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken(user.id, jti);
  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: thirtyDaysFromNow(),
    },
  });
  return { accessToken, refreshToken, user };
};

export const revokeRefreshToken = async (token: string) => {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

/**
 * Verify the refresh token and issue a new access token. The refresh token
 * itself is left untouched (still valid until its natural expiry) so that
 * concurrent tabs and background-tab reloads don't fight over a freshly
 * rotated token and end up logged out.
 *
 * Throws `Unauthorized` for any invalid/expired/revoked/mismatched token.
 */
export const refreshSession = async (token: string) => {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw Unauthorized('Invalid refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw Unauthorized('Invalid refresh token');
  }
  if (stored.userId !== payload.sub) throw Unauthorized('Invalid refresh token');
  if (stored.user.status !== 'ACTIVE') throw Unauthorized('Account not active');

  // Issue only a new access token — keep the existing refresh token alive
  // until it naturally expires. Re-using the same refresh token avoids the
  // multi-tab refresh race where the first rotation invalidates concurrent
  // refresh attempts in other tabs and forces the user back to /login.
  const accessToken = signAccessToken({
    sub:   stored.user.id,
    email: stored.user.email,
    role:  stored.user.role,
  });
  return { accessToken, refreshToken: token, user: stored.user };
};
