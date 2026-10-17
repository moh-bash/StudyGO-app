/**
 * Maps low-level failures to user-facing Arabic messages.
 *
 * Raw server responses, stack traces, tokens, and credentials are never
 * surfaced to the UI. Backend error bodies are English and are not shown
 * directly; instead they are collapsed into understandable Arabic messages
 * based on the HTTP status.
 */
import { ApiError, ConfigError, NetworkError, ResponseParseError } from '../api/errors';
import { TokenStorageError } from '../storage/token-storage';

export type AuthErrorContext = 'login' | 'register';

/**
 * Returns an Arabic message for the given error.
 *
 * @param context tunes the `401` message: login attempts explain bad
 *   credentials, while other flows describe an expired session.
 */
export function mapAuthError(error: unknown, context: AuthErrorContext = 'login'): string {
  if (error instanceof NetworkError) {
    return 'تعذّر الاتصال بالخادم. تأكّد من اتصالك بالإنترنت ثم حاول مجددًا.';
  }
  if (error instanceof ConfigError) {
    return 'تعذّر الاتصال بالخادم بسبب إعدادات غير مكتملة في التطبيق.';
  }
  if (error instanceof TokenStorageError) {
    return 'تعذّر حفظ الجلسة بشكل آمن على هذا الجهاز.';
  }
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 400:
        return 'البيانات المُدخلة غير صحيحة. يرجى مراجعة الحقول والمحاولة مجددًا.';
      case 401:
        return context === 'login'
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
          : 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول من جديد.';
      case 403:
        return 'حسابك موقوف حاليًا. يرجى التواصل مع الدعم.';
      case 409:
        return 'يوجد حساب مسجّل بهذا البريد الإلكتروني بالفعل.';
      case 429:
        return 'محاولات كثيرة في وقت قصير. يرجى المحاولة بعد قليل.';
      default:
        return error.statusCode >= 500
          ? 'حدث خطأ في الخادم. يرجى المحاولة لاحقًا.'
          : 'تعذّر إتمام العملية. حاول مرة أخرى.';
    }
  }
  if (error instanceof ResponseParseError) {
    return 'حدث خطأ في الاتصال بالخادم. حاول مرة أخرى.';
  }
  return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
}
