/**
 * Typed route bindings for the verified authentication endpoints.
 *
 * These are thin wrappers over {@link apiRequest}. They contain no session
 * state and no UI; session/token orchestration lives in `lib/auth/session.ts`
 * and the screens call through the `AuthContext`.
 *
 * Routes verified against `study-go-api/src/auth/auth.controller.ts` and
 * `src/users/users.controller.ts`. Access rules noted inline; `auth: true`
 * attaches the stored bearer token.
 */
import { apiRequest } from './client';
import type {
  AuthResponse,
  MessageResponse,
  RefreshTokenRequest,
  RegisterRequest,
  LoginRequest,
  User,
} from './types';

export const authApi = {
  /** `POST /auth/register` (public). */
  register: (body: RegisterRequest): Promise<AuthResponse> =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body }),

  /** `POST /auth/login` (public). */
  login: (body: LoginRequest): Promise<AuthResponse> =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body }),

  /** `POST /auth/refresh` (public; exchanges a refresh token). */
  refresh: (body: RefreshTokenRequest): Promise<AuthResponse> =>
    apiRequest<AuthResponse>('/auth/refresh', { method: 'POST', body }),

  /**
   * `POST /auth/logout` (authenticated; revokes a refresh token).
   *
   * `retryOnUnauthorized: false` is essential: logout must never trigger a token
   * refresh, otherwise a refresh in flight during sign-out could re-persist a
   * fresh token pair after local credentials were cleared.
   */
  logout: (body: RefreshTokenRequest): Promise<MessageResponse> =>
    apiRequest<MessageResponse>('/auth/logout', {
      method: 'POST',
      body,
      auth: true,
      retryOnUnauthorized: false,
    }),

  /** `GET /auth/me` (authenticated). */
  me: (options?: { signal?: AbortSignal }): Promise<User> =>
    apiRequest<User>('/auth/me', { auth: true, signal: options?.signal }),
};

export const usersApi = {
  /** `GET /users/me` (authenticated). */
  me: (options?: { signal?: AbortSignal }): Promise<User> =>
    apiRequest<User>('/users/me', { auth: true, signal: options?.signal }),
};
