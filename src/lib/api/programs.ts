/**
 * Typed route bindings for the public academic-program endpoints.
 *
 * Thin wrappers over {@link apiRequest}; they hold no UI or selection state.
 * Only the endpoints verified against `study-go-api` are declared here:
 *
 * - `GET /programs/registration` (`ProgramsController.findForRegistration`),
 *   `@Public()` — unauthenticated. Returns a **bare array** (no `{ data }`
 *   envelope) of active programs, each exposing only `id`, `name`, `code`.
 *
 * Responses are validated at runtime (`parseRegistrationPrograms`) so a
 * malformed body is rejected before it reaches the UI.
 */
import { apiRequest } from './client';
import { ResponseParseError } from './errors';
import type { RegistrationProgram } from './types';

function parseRegistrationProgram(value: unknown, index: number): RegistrationProgram {
  if (typeof value !== 'object' || value === null) {
    throw new ResponseParseError(`Malformed program at index ${index}: not an object.`);
  }
  const program = value as Record<string, unknown>;
  if (typeof program.id !== 'string' || program.id.length === 0) {
    throw new ResponseParseError(`Malformed program at index ${index}: missing id.`);
  }
  if (typeof program.name !== 'string' || program.name.length === 0) {
    throw new ResponseParseError(`Malformed program at index ${index}: missing name.`);
  }
  return {
    id: program.id,
    name: program.name,
    code: typeof program.code === 'string' ? program.code : null,
  };
}

/** Validates and narrows the bare-array body of `GET /programs/registration`. */
export function parseRegistrationPrograms(value: unknown): RegistrationProgram[] {
  if (!Array.isArray(value)) {
    throw new ResponseParseError('Malformed programs response: expected an array.');
  }
  return value.map((item, index) => parseRegistrationProgram(item, index));
}

export const programsApi = {
  /** `GET /programs/registration` (public). */
  registration: (options?: { signal?: AbortSignal }): Promise<RegistrationProgram[]> =>
    apiRequest<unknown>('/programs/registration', { signal: options?.signal }).then(
      parseRegistrationPrograms,
    ),
};
