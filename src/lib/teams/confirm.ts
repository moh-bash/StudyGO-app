/**
 * A promise-based confirmation dialog.
 *
 * React Native's `Alert.alert` is callback-based, which makes "ask, then
 * continue" awkward: every caller has to nest its work inside an `onPress`
 * handler and to remember that the *cancel* branch must undo whatever the
 * confirm branch started. This module turns the dialog into a single promise
 * that resolves to `true` (confirmed) or `false` (cancelled / dismissed), so
 * the destructive work can live in one straight-line `if`.
 *
 * The dialog implementation is injected, which keeps this module free of
 * React Native imports and therefore unit-testable (the project has no
 * renderer). The platform binding lives in `features/teams/confirm.ts`.
 */

/** The button shape this module uses (a subset of React Native's `AlertButton`). */
export interface ConfirmButton {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (value?: string) => void;
}

/** The dialog options this module uses (a subset of React Native's `AlertOptions`). */
export interface ConfirmDialogOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

/** The subset of `Alert.alert` this module relies on. */
export type ConfirmAlert = (
  title: string,
  message?: string,
  buttons?: ConfirmButton[],
  options?: ConfirmDialogOptions,
) => void;

/** What the confirmation dialog should say and how it should be labelled. */
export interface ConfirmRequest {
  title: string;
  message: string;
  /** The label of the confirming (destructive) button. */
  confirmLabel: string;
  /** The label of the cancel button. Defaults to {@link DEFAULT_CANCEL_LABEL}. */
  cancelLabel?: string;
  /**
   * Whether the confirming button is destructive (red on iOS). Defaults to
   * `true`: this helper exists for destructive confirmations.
   */
  destructive?: boolean;
}

/** The Arabic cancel label used when the caller does not provide one. */
export const DEFAULT_CANCEL_LABEL = 'إلغاء';

/**
 * Shows a confirmation dialog and resolves to the student's answer.
 *
 * The promise settles exactly once:
 *
 * - the confirming button resolves `true`;
 * - the cancel button resolves `false`;
 * - dismissing the dialog without choosing (Android back button or a tap
 *   outside the dialog) resolves `false` — a dismissal is never a consent.
 *
 * The "settled once" guard matters because a platform may report both a
 * button press and a dismissal for the same interaction; without it the
 * promise would resolve twice and the second (wrong) answer could win.
 */
export function confirmDestructive(
  request: ConfirmRequest,
  alert: ConfirmAlert,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    alert(
      request.title,
      request.message,
      [
        {
          text: request.cancelLabel ?? DEFAULT_CANCEL_LABEL,
          style: 'cancel',
          onPress: () => finish(false),
        },
        {
          text: request.confirmLabel,
          style: request.destructive === false ? 'default' : 'destructive',
          onPress: () => finish(true),
        },
      ],
      {
        cancelable: true,
        // Android only: the dialog was dismissed without a button press.
        onDismiss: () => finish(false),
      },
    );
  });
}
