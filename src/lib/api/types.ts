/**
 * API contract types for the mobile client.
 *
 * Only contracts that were verified against the actual backend implementation
 * are declared here. Each type notes its source so future changes can be
 * re-checked. Contracts that have not been verified are intentionally omitted
 * rather than guessed.
 *
 * Sources (read-only inspection of `study-go-api`):
 * - `src/auth/dto/auth-response.dto.ts`
 * - `src/auth/dto/login.dto.ts`, `src/auth/dto/register.dto.ts`
 * - `src/auth/dto/refresh-token.dto.ts`
 * - `src/users/dto/user-response.dto.ts`
 * - `src/programs/dto/registration-program.dto.ts`
 * - `src/common/filters/all-exceptions.filter.ts`
 * - `src/common/enums.ts`
 */

/** `UserRole` (`src/common/enums.ts`). All four server-side roles. */
export type UserRole = 'STUDENT' | 'ADMIN' | 'PROGRAM_MANAGER' | 'SUBJECT_MANAGER';

/** `AccountStatus` (`src/common/enums.ts`). */
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

/**
 * `UserResponseDto` (`src/users/dto/user-response.dto.ts`).
 * Timestamps are serialized to ISO-8601 strings over JSON.
 */
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  profileImageUrl: string | null;
  studentUniversityId: string | null;
  phone: string | null;
  programId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `AuthResponseDto` (`src/auth/dto/auth-response.dto.ts`). */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** `MessageResponseDto` (`src/auth/dto/auth-response.dto.ts`). */
export interface MessageResponse {
  message: string;
}

/** Request body for `POST /auth/login` (`LoginDto`). */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Minimal projection of an active academic program
 * (`RegistrationProgramDto`), returned by the public
 * `GET /programs/registration` endpoint. Only `id`, `name`, and `code` are
 * exposed; `code` is nullable.
 */
export interface RegistrationProgram {
  id: string;
  name: string;
  code: string | null;
}

/**
 * Request body for `POST /auth/register` (`RegisterDto`).
 * Password must be 8-72 chars and contain at least one letter and one number.
 */
export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  /** Optional university student id. */
  studentUniversityId?: string;
  /**
   * Selected academic program UUID — **required** by the backend `RegisterDto`.
   * Registered against the program's `id` from `GET /programs/registration`;
   * the server validates that it exists and is active. Never a program
   * name/code, and never a client-chosen role.
   */
  programId: string;
  /** Optional contact phone number (5-20 digits, optional leading +). */
  phone?: string;
}

/** Request body for `POST /auth/refresh` and `POST /auth/logout`. */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Backend error envelope produced by `AllExceptionsFilter`
 * (`src/common/filters/all-exceptions.filter.ts`). `message` is a string for
 * most errors, but is an array of validation messages for `400` responses.
 */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
}
