/**
 * Client-side validation for the authentication forms.
 *
 * Rules mirror the verified backend DTOs (`study-go-api/src/auth/dto`):
 * - `fullName`: 2-150 characters
 * - `email`: valid email, max 254 characters
 * - `password`: 8-72 characters, at least one letter and one number
 *
 * Messages are returned in Arabic; a `null` return means the value is valid.
 */

export const NAME_MIN = 2;
export const NAME_MAX = 150;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export function validateFullName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'الرجاء إدخال الاسم الكامل';
  }
  if (trimmed.length < NAME_MIN) {
    return 'يجب أن يتكوّن الاسم الكامل من حرفين على الأقل';
  }
  if (trimmed.length > NAME_MAX) {
    return 'الاسم الكامل طويل جدًا';
  }
  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'الرجاء إدخال البريد الإلكتروني';
  }
  if (trimmed.length > EMAIL_MAX) {
    return 'البريد الإلكتروني طويل جدًا';
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'الرجاء إدخال بريد إلكتروني صحيح';
  }
  return null;
}

/** Password rule used on the registration form. */
export function validatePassword(value: string): string | null {
  if (value.length === 0) {
    return 'الرجاء إدخال كلمة المرور';
  }
  if (value.length < PASSWORD_MIN) {
    return 'يجب أن تتكوّن كلمة المرور من 8 أحرف على الأقل';
  }
  if (value.length > PASSWORD_MAX) {
    return 'كلمة المرور طويلة جدًا';
  }
  if (!PASSWORD_PATTERN.test(value)) {
    return 'يجب أن تحتوي كلمة المرور على حرف ورقم معًا';
  }
  return null;
}

/** Log-in only requires a non-empty password (backend `LoginDto`). */
export function validateLoginPassword(value: string): string | null {
  if (value.length === 0) {
    return 'الرجاء إدخال كلمة المرور';
  }
  return null;
}

/**
 * Confirmation is a local-only check; the backend `RegisterDto` has no such
 * field and the value is never sent to the server.
 */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (confirmation.length === 0) {
    return 'الرجاء تأكيد كلمة المرور';
  }
  if (password !== confirmation) {
    return 'كلمتا المرور غير متطابقتين';
  }
  return null;
}
