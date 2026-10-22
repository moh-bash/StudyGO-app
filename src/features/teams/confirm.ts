/**
 * The React Native binding for the promise-based confirmation dialog.
 *
 * `lib/teams/confirm.ts` holds the platform-independent logic; this file only
 * supplies React Native's `Alert.alert`. Keeping the two apart is what makes
 * the dialog's "resolves exactly once" rule unit-testable in a project that
 * has no renderer.
 */
import { Alert } from 'react-native';
import {
  confirmDestructive as confirmWithAlert,
  type ConfirmRequest,
} from '@/lib/teams/confirm';

export type { ConfirmRequest };

/**
 * Shows a confirmation dialog and resolves to the student's answer.
 *
 * Resolves `true` only when the confirming button was pressed; a cancel or a
 * dismissal resolves `false`.
 */
export function confirmDestructive(request: ConfirmRequest): Promise<boolean> {
  return confirmWithAlert(request, Alert.alert);
}
