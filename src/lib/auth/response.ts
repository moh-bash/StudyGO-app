/**
 * Runtime validation of authentication payloads returned by the backend.
 *
 * The TypeScript types in `lib/api/types.ts` describe the contract, but a
 * successful HTTP response is not proof of a valid body. These guards reject
 * missing/malformed tokens or profiles *before* anything is persisted, so a bad
 * response can never create a half-built session.
 *
 * Shapes verified against `study-go-api`: `AuthResponseDto`
 * (`accessToken`, `refreshToken`, `user`) and `UserResponseDto`. Auth responses
 * are returned bare (no `{ data }` wrapper); only list endpoints use an envelope.
 */
import { ResponseParseError } from '../api/errors';
import type { AccountStatus, AuthResponse, User, UserRole } from '../api/types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function asRole(value: unknown): UserRole {
  return value === 'ADMIN' ? 'ADMIN' : 'STUDENT';
}

function asStatus(value: unknown): AccountStatus {
  return value === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
}

/** Validates and narrows a `UserResponseDto` payload. */
export function parseUser(value: unknown): User {
  if (typeof value !== 'object' || value === null) {
    throw new ResponseParseError('Malformed user payload: not an object.');
  }
  const user = value as Record<string, unknown>;
  if (!isNonEmptyString(user.id) || !isNonEmptyString(user.fullName) || !isNonEmptyString(user.email)) {
    throw new ResponseParseError('Malformed user payload: missing id/name/email.');
  }
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: asRole(user.role),
    status: asStatus(user.status),
    profileImageUrl: typeof user.profileImageUrl === 'string' ? user.profileImageUrl : null,
    studentUniversityId: typeof user.studentUniversityId === 'string' ? user.studentUniversityId : null,
    programId: typeof user.programId === 'string' ? user.programId : null,
    createdAt: typeof user.createdAt === 'string' ? user.createdAt : '',
    updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : '',
  };
}

/** Validates and narrows an `AuthResponseDto` payload (login/register/refresh). */
export function parseAuthResponse(value: unknown): AuthResponse {
  if (typeof value !== 'object' || value === null) {
    throw new ResponseParseError('Malformed auth response: not an object.');
  }
  const response = value as Record<string, unknown>;
  if (!isNonEmptyString(response.accessToken) || !isNonEmptyString(response.refreshToken)) {
    throw new ResponseParseError('Malformed auth response: missing tokens.');
  }
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: parseUser(response.user),
  };
}
