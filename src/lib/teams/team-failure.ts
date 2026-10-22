/**
 * Arabic wording for the failures the team lifecycle can produce.
 *
 * The backend answers with English exception messages ("Only the team creator
 * can perform this action"). Showing those verbatim would break the app's
 * language, so every failure is re-worded here, keyed off the *kind* of
 * failure rather than the raw message.
 *
 * The classification follows the same rule the rest of the app uses (see
 * `lib/api/connection.ts`): only a genuine transport failure may be worded as
 * a connectivity problem. A timeout is a slow server, an aborted request says
 * nothing at all, and an HTTP status is the backend answering.
 */
import { classifyTeamsFailure } from '../api/connection';
import { ApiError, NetworkError } from '../api/errors';

/** Which team operation failed. */
export type TeamLifecycleAction =
  | 'delete-team'
  | 'leave-team'
  | 'cancel-request'
  | 'verify'
  | 'create-team'
  | 'open-team'
  | 'join-team'
  | 'update-team'
  | 'decide-request';

export interface TeamFailureWording {
  /** The dialog title. */
  title: string;
  /** The Arabic explanation shown under the title. */
  message: string;
  /**
   * True only when the device genuinely could not reach the backend. Callers
   * must never present another kind of failure as a connectivity problem.
   */
  offline: boolean;
}

const TITLES: Record<TeamLifecycleAction, string> = {
  'delete-team': 'تعذّر حذف الفريق',
  'leave-team': 'تعذّر مغادرة الفريق',
  'cancel-request': 'تعذّر إلغاء الطلب',
  verify: 'تعذّر التحقق من حالة الفريق',
  'create-team': 'تعذّر إنشاء الفريق',
  'open-team': 'تعذّر فتح الفريق',
  'join-team': 'تعذّر إرسال طلب الانضمام',
  'update-team': 'تعذّر حفظ التعديلات',
  'decide-request': 'تعذّر تحديث الطلب',
};

/** The wording for "you are not allowed to do this" (HTTP 403). */
const FORBIDDEN: Record<TeamLifecycleAction, string> = {
  'delete-team': 'حذف الفريق متاح لمنشئه فقط. لا يمكنك حذف فريق أنشأه شخص آخر.',
  'leave-team': 'لا تملك صلاحية مغادرة هذا الفريق.',
  'cancel-request': 'لا تملك صلاحية إلغاء هذا الطلب.',
  verify: 'لا تملك صلاحية عرض حالة الفريق في هذا المقرر.',
  'create-team': 'لا تملك صلاحية إنشاء فريق في هذا المقرر.',
  'open-team': 'لا تملك صلاحية عرض هذا الفريق.',
  'join-team': 'لا تملك صلاحية الانضمام إلى هذا الفريق.',
  'update-team': 'لا تملك صلاحية تعديل هذا الفريق.',
  'decide-request': 'لا تملك صلاحية معالجة طلبات الانضمام في هذا الفريق.',
};

/** The wording for "the request itself is not allowed" (HTTP 400). */
const BAD_REQUEST: Record<TeamLifecycleAction, string> = {
  'delete-team': 'لا يمكن حذف الفريق في حالته الحالية.',
  'leave-team': 'أنت منشئ هذا الفريق؛ يمكنك حذف الفريق بدل مغادرته.',
  'cancel-request': 'لا يمكن إلغاء الطلب في حالته الحالية.',
  verify: 'تعذّر التحقق من حالة الفريق في هذا المقرر.',
  'create-team': 'تعذّر إنشاء الفريق. تأكد من بيانات الفريق ومن الشعبة المختارة.',
  'open-team': 'لا يمكن عرض هذا الفريق في حالته الحالية.',
  'join-team': 'لا يمكن إرسال طلب الانضمام في الحالة الحالية.',
  'update-team': 'لا يمكن حفظ التعديلات على هذا الفريق في حالته الحالية.',
  'decide-request': 'لا يمكن معالجة هذا الطلب في حالته الحالية.',
};

/** The wording for "it is gone" (HTTP 404). */
const NOT_FOUND: Record<TeamLifecycleAction, string> = {
  'delete-team': 'الفريق غير موجود أو تم حذفه مسبقًا.',
  'leave-team': 'الفريق غير موجود أو تم حذفه مسبقًا.',
  'cancel-request': 'الطلب غير موجود أو تم إلغاؤه مسبقًا.',
  verify: 'الفريق غير موجود أو تم حذفه مسبقًا.',
  'create-team': 'تعذّر العثور على المقرر أو الشعبة المختارة.',
  'open-team': 'الفريق غير متاح لشعبتك المختارة. حدّث القائمة أو غيّر شعبتك.',
  'join-team': 'الفريق غير متاح لشعبتك المختارة. حدّث القائمة أو غيّر شعبتك.',
  'update-team': 'الفريق غير موجود أو تم حذفه مسبقًا.',
  'decide-request': 'الطلب غير موجود أو تم حسمه مسبقًا.',
};

/** The wording for "the state moved on" (HTTP 409). */
const CONFLICT: Record<TeamLifecycleAction, string> = {
  'delete-team': 'تغيّرت حالة الفريق. حدّث البيانات ثم أعد المحاولة.',
  'leave-team': 'تغيّرت حالة الفريق. حدّث البيانات ثم أعد المحاولة.',
  'cancel-request': 'تغيّر حالة الطلب. حدّث البيانات ثم أعد المحاولة.',
  verify: 'تغيّرت حالة الفريق. حدّث البيانات ثم أعد المحاولة.',
  'create-team': 'لديك فريق أو طلب انضمام في هذا المقرر. حدّث البيانات ثم أعد المحاولة.',
  'open-team': 'تغيّرت حالة الفريق. حدّث القائمة ثم أعد المحاولة.',
  'join-team': 'تغيّرت حالة الفريق أو المهمة. حدّث القائمة ثم أعد المحاولة.',
  'update-team': 'تغيّرت حالة الفريق. حدّث البيانات ثم أعد المحاولة.',
  'decide-request': 'تغيّرت حالة الطلب. حدّث القائمة ثم أعد المحاولة.',
};

/**
 * The wording for a section that cannot back a team.
 *
 * The server refuses to create a team for a section that has no assigned
 * professor ("The selected section has no assigned professor"). The student did
 * select a section, so the message must name the real reason instead of
 * pretending that no section was selected.
 */
const SECTION_WITHOUT_PROFESSOR =
  'الشعبة المختارة لا يوجد لها أستاذ مسؤول، فلا يمكن إنشاء فريق فيها. اختر شعبة أخرى.';

/** True for the server's "this section has no assigned professor" rejection. */
function isSectionWithoutProfessor(error: ApiError): boolean {
  return /no assigned professor/i.test(error.message);
}

/**
 * Describes a failed team operation in Arabic.
 *
 * @param error  the caught error (any shape)
 * @param action which operation failed
 */
export function describeTeamFailure(
  error: unknown,
  action: TeamLifecycleAction,
): TeamFailureWording {
  const title = TITLES[action];

  if (error instanceof NetworkError) {
    if (error.kind === 'transport') {
      // The only kind of failure that proves the device is offline.
      return {
        title,
        message: 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.',
        offline: true,
      };
    }
    if (error.kind === 'timeout') {
      // The backend answered too slowly: a server problem, not a lost network.
      return {
        title,
        message: 'استغرق الخادم وقتًا طويلًا للاستجابة. حاول مرة أخرى.',
        offline: false,
      };
    }
    // The request was cancelled before it completed: it says nothing about
    // the server, so it gets the neutral wording.
    return {
      title,
      message: 'تم إلغاء العملية. حاول مرة أخرى.',
      offline: false,
    };
  }

  if (error instanceof ApiError) {
    const status = error.statusCode;
    if (status === 401) {
      return {
        title,
        message: 'انتهت صلاحية الجلسة. سجّل الدخول من جديد.',
        offline: false,
      };
    }
    if (status === 403) {
      return { title, message: FORBIDDEN[action], offline: false };
    }
    if (status === 400) {
      if (action === 'create-team' && isSectionWithoutProfessor(error)) {
        return { title, message: SECTION_WITHOUT_PROFESSOR, offline: false };
      }
      return { title, message: BAD_REQUEST[action], offline: false };
    }
    if (status === 404) {
      return { title, message: NOT_FOUND[action], offline: false };
    }
    if (status === 409) {
      return { title, message: CONFLICT[action], offline: false };
    }
    if (status >= 500) {
      return {
        title,
        message: 'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.',
        offline: false,
      };
    }
  }

  return {
    title,
    message: 'تعذّر إكمال العملية. حاول مرة أخرى.',
    offline: false,
  };
}

export interface TeamFailureNotice {
  /** The message to render, or `null` when the failure should stay silent. */
  message: string | null;
  /** True only when the device genuinely could not reach the backend. */
  offline: boolean;
}

/**
 * The wording for a failure that is surfaced as a banner instead of a dialog.
 *
 * A backend rejection is re-worded in Arabic — the server's English message
 * ("Team not found") must never reach the student, and it says nothing useful
 * about their own section. A transport or timeout failure keeps the connection
 * wording, including the rule that a failure while data is already on screen
 * is not presented as a lost connection.
 */
export function teamFailureNotice(
  error: unknown,
  hasDisplayableData: boolean,
  action: TeamLifecycleAction,
): TeamFailureNotice {
  if (error instanceof ApiError) {
    const wording = describeTeamFailure(error, action);
    return { message: wording.message, offline: wording.offline };
  }
  const info = classifyTeamsFailure(error, hasDisplayableData);
  return { message: info.message, offline: info.offline };
}
