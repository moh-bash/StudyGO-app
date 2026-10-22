/**
 * Unit tests for the promise-based confirmation dialog.
 *
 * The dialog itself is injected, so the interesting behaviour — which answer
 * the promise resolves with, and that it resolves exactly once — is verified
 * here without a renderer.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  confirmDestructive,
  DEFAULT_CANCEL_LABEL,
  type ConfirmAlert,
  type ConfirmButton,
  type ConfirmDialogOptions,
} from './confirm';

interface Captured {
  title: string;
  message?: string;
  buttons: ConfirmButton[];
  options?: ConfirmDialogOptions;
}

/** Captures the dialog instead of showing it, and exposes its parts. */
function capture(): { alert: ConfirmAlert; captured: Captured } {
  const captured: Captured = { title: '', message: undefined, buttons: [] };
  const alert: ConfirmAlert = (title, message, buttons, options) => {
    captured.title = title;
    captured.message = message;
    captured.buttons = buttons ?? [];
    captured.options = options;
  };
  return { alert, captured };
}

const request = {
  title: 'حذف الفريق',
  message: 'سيتم حذف الفريق بالكامل.',
  confirmLabel: 'حذف الفريق',
};

describe('confirmDestructive', () => {
  it('resolves true when the student confirms', async () => {
    const { alert, captured } = capture();

    const answer = confirmDestructive(request, alert);
    captured.buttons.find((button) => button.style === 'destructive')?.onPress?.();

    await expect(answer).resolves.toBe(true);
  });

  it('resolves false when the student cancels', async () => {
    const { alert, captured } = capture();

    const answer = confirmDestructive(request, alert);
    captured.buttons.find((button) => button.style === 'cancel')?.onPress?.();

    await expect(answer).resolves.toBe(false);
  });

  it('resolves false when the dialog is dismissed without a choice', async () => {
    const { alert, captured } = capture();

    const answer = confirmDestructive(request, alert);
    captured.options?.onDismiss?.();

    await expect(answer).resolves.toBe(false);
  });

  it('keeps the confirmation when a dismissal follows the confirming press', async () => {
    const { alert, captured } = capture();

    const answer = confirmDestructive(request, alert);
    captured.buttons.find((button) => button.style === 'destructive')?.onPress?.();
    // Some platforms report the dismissal right after the button press; the
    // first answer must win, otherwise a confirmed action would be cancelled.
    captured.options?.onDismiss?.();

    await expect(answer).resolves.toBe(true);
  });

  it('settles exactly once', async () => {
    const { alert, captured } = capture();
    const onResolve = vi.fn();

    const answer = confirmDestructive(request, alert);
    void answer.then(onResolve);
    captured.buttons.find((button) => button.style === 'destructive')?.onPress?.();
    captured.buttons.find((button) => button.style === 'cancel')?.onPress?.();
    captured.options?.onDismiss?.();
    await Promise.resolve();

    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it('shows the requested copy and an Arabic cancel label by default', async () => {
    const { alert, captured } = capture();

    void confirmDestructive(request, alert);

    expect(captured.title).toBe('حذف الفريق');
    expect(captured.message).toBe('سيتم حذف الفريق بالكامل.');
    expect(captured.buttons.map((button) => button.text)).toEqual([
      DEFAULT_CANCEL_LABEL,
      'حذف الفريق',
    ]);
  });

  it('honours a custom cancel label', async () => {
    const { alert, captured } = capture();

    void confirmDestructive({ ...request, cancelLabel: 'تراجع' }, alert);

    expect(captured.buttons[0]?.text).toBe('تراجع');
  });

  it('marks the confirming button as destructive unless told otherwise', async () => {
    const { alert, captured } = capture();

    void confirmDestructive(request, alert);
    expect(captured.buttons[1]?.style).toBe('destructive');

    const second = capture();
    void confirmDestructive({ ...request, destructive: false }, second.alert);
    expect(second.captured.buttons[1]?.style).toBe('default');
  });
});
