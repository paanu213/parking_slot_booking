import type { User } from '@prisma/client';
import type { UserDTO } from '@ps/types';

/**
 * Single source of truth for the public user shape.
 * Matches `UserDTO` in `@ps/types` so frontends can rely on a stable contract.
 */
export const toUserDTO = (user: Pick<
  User,
  'id' | 'email' | 'fullName' | 'role' | 'phone' | 'avatarUrl'
>): UserDTO => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role as UserDTO['role'],
  phone: user.phone ?? null,
  avatarUrl: user.avatarUrl ?? null,
});

/** The Prisma `select` clause that yields exactly the columns `toUserDTO` needs. */
export const userDtoSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  phone: true,
  avatarUrl: true,
} as const;
