/**
 * Phase 5 — the Teams tab of the subject-details screen.
 *
 * Renders the whole subject-team surface for one subject+term:
 *
 * - the caller's own team (with its task slots and, for the creator, the pending
 *   request queue);
 * - a browsable list of the teams the *server* deems visible to the caller;
 * - a create form with one task field per member slot;
 * - a detail sheet showing the slots, permitted members, and the join action;
 * - external-contact actions that open only allowlisted `https` destinations.
 *
 * Copy is Arabic (RTL) throughout. The component performs no eligibility logic
 * of its own: visibility, capacity and the one-team rule are all server-side.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, PressableCard } from '@/components/ui/card';
import { Chip, ChipRow } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { SelectField, type SelectOption } from '@/components/ui/select-field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { useThemeColors } from '@/constants/theme';
import { confirmDestructive } from '@/features/teams/confirm';
import { useSubjectTeams } from '@/features/teams/use-subject-teams';
import type { Catalog, CatalogSection } from '@/lib/api/catalog';
import { resolveSelectedSectionId } from '@/lib/courses/section-scope';
import type {
  CreatorJoinRequest,
  SubjectTeamContactMethod,
  SubjectTeamDetail,
  SubjectTeamScope,
  SubjectTeamSummary,
} from '@/lib/api/subject-teams';
import {
  buildContactUrl,
  DEFAULT_CONTACT_MESSAGE,
  isOpenableUrl,
  withMessage,
} from '@/lib/teams/contact-action';
import { describeTeamFailure, type TeamLifecycleAction } from '@/lib/teams/team-failure';
import * as Linking from 'expo-linking';
import {
  AlertTriangle,
  MessageCircle,
  Pencil,
  RefreshCw,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

const SCOPE_LABELS: Record<SubjectTeamScope, string> = {
  SECTION: 'شعبتي فقط',
  PROFESSOR: 'شعب نفس الأستاذ',
};

const CONTACT_LABELS: Record<SubjectTeamContactMethod, string> = {
  WHATSAPP_PHONE: 'رقم واتساب',
  TELEGRAM: 'معرّف تلغرام',
  GROUP_LINK: 'رابط مجموعة',
};

const CONTACT_PLACEHOLDERS: Record<SubjectTeamContactMethod, string> = {
  WHATSAPP_PHONE: '+966501234567',
  TELEGRAM: 'username@',
  GROUP_LINK: 'https://chat.whatsapp.com/...',
};

const CONTACT_OPTIONS: SelectOption[] = (
  Object.keys(CONTACT_LABELS) as SubjectTeamContactMethod[]
).map((value) => ({ value, label: CONTACT_LABELS[value] }));

const SCOPE_OPTIONS: SelectOption[] = (
  Object.keys(SCOPE_LABELS) as SubjectTeamScope[]
).map((value) => ({ value, label: SCOPE_LABELS[value] }));

interface TeamsPanelProps {
  catalog: Catalog;
  subjectId: string;
  semesterId: string;
  /** The student's local planning pick for this subject+term, if any. */
  sectionId: string | null;
  sections: CatalogSection[];
}

export function TeamsPanel({
  catalog,
  subjectId,
  semesterId,
  sectionId,
  sections,
}: TeamsPanelProps) {
  const teams = useSubjectTeams({ subjectId, semesterId, sectionId });
  const [mode, setMode] = useState<'browse' | 'create'>('browse');
  const [busy, setBusy] = useState(false);

  const openContact = async (
    method: SubjectTeamContactMethod | null,
    value: string | null,
    withDefaultMessage: boolean,
  ) => {
    const action = buildContactUrl(method, value);
    if (!action) {
      Alert.alert('لا يمكن فتح الرابط', 'طريقة التواصل غير صالحة أو غير مدعومة.');
      return;
    }
    const target = withDefaultMessage ? withMessage(action, DEFAULT_CONTACT_MESSAGE) : action.url;
    // Guard again at the boundary: only an http(s) URL ever reaches the opener.
    const url = target && isOpenableUrl(target) ? target : action.url;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('تعذّر فتح الرابط', 'لا يوجد تطبيق يمكنه فتح هذا الرابط على جهازك.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('تعذّر فتح الرابط', 'حدث خطأ أثناء محاولة فتح الرابط.');
    }
  };

  /**
   * Runs a team operation and words any failure in Arabic.
   *
   * The backend answers with English exception messages; showing them
   * verbatim would break the app's language (and would tell the student
   * nothing useful about a rejected section).
   */
  const run = async (
    operation: () => Promise<void>,
    action: TeamLifecycleAction,
  ): Promise<boolean> => {
    setBusy(true);
    try {
      await operation();
      return true;
    } catch (e) {
      const wording = describeTeamFailure(e, action);
      Alert.alert(wording.title, wording.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Deletes the team the caller created.
   *
   * The confirmation spells out the impact — every member loses their
   * membership and every pending join request is cancelled — because the
   * action cannot be undone from the app. The button is only ever rendered
   * for the creator, and the server refuses the request for anybody else.
   */
  const handleDeleteTeam = async (team: SubjectTeamDetail) => {
    const confirmed = await confirmDestructive({
      title: 'حذف الفريق',
      message: `سيتم حذف فريق «${team.name}» بالكامل، وإلغاء عضوية جميع الأعضاء (${team.memberCount} أعضاء) وطلبات الانضمام المعلّقة. لا يمكن التراجع عن هذه الخطوة.`,
      confirmLabel: 'حذف الفريق',
      cancelLabel: 'إلغاء',
    });
    if (!confirmed) {
      return;
    }
    setBusy(true);
    try {
      await teams.deleteTeam(team.id);
      Alert.alert(
        'تم حذف الفريق',
        `حُذف فريق «${team.name}» وكل طلبات الانضمام المعلّقة.`,
      );
    } catch (e) {
      const wording = describeTeamFailure(e, 'delete-team');
      Alert.alert(wording.title, wording.message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Leaves a team somebody else created: only the caller's own membership and
   * task slot go away, the team and its other members stay untouched.
   */
  const handleLeaveTeam = async (team: SubjectTeamDetail) => {
    const confirmed = await confirmDestructive({
      title: 'مغادرة الفريق',
      message: `سيتم إخراجك من فريق «${team.name}» وإتاحة مهمتك لعضو آخر. يبقى باقي أعضاء الفريق كما هم.`,
      confirmLabel: 'مغادرة الفريق',
      cancelLabel: 'إلغاء',
    });
    if (!confirmed) {
      return;
    }
    setBusy(true);
    try {
      await teams.leaveTeam(team.id);
      Alert.alert(
        'غادرت الفريق',
        `تم إخراجك من فريق «${team.name}» وإتاحة مهمتك لعضو آخر.`,
      );
    } catch (e) {
      const wording = describeTeamFailure(e, 'leave-team');
      Alert.alert(wording.title, wording.message);
    } finally {
      setBusy(false);
    }
  };

  if (teams.detail) {
    return (
      <TeamDetailView
        team={teams.detail}
        requests={teams.requests}
        busy={busy}
        onBack={teams.closeTeam}
        onOpenContact={openContact}
        onRequestJoin={(slotId, message) =>
          run(() => teams.requestJoin(teams.detail!.id, slotId, message), 'join-team')
        }
        onDecide={(requestId, approve) =>
          run(
            () => teams.decideRequest(teams.detail!.id, requestId, approve),
            'decide-request',
          )
        }
        onCancelMine={(requestId) =>
          run(() => teams.cancelRequest(teams.detail!.id, requestId), 'cancel-request')
        }
        onDeleteTeam={(team) => handleDeleteTeam(team)}
        onLeaveTeam={(team) => handleLeaveTeam(team)}
        onEdit={(input) => run(() => teams.updateTeam(teams.detail!.id, input), 'update-team')}      />
    );
  }

  return (
    <View className="gap-4">
      {teams.error ? (
        <ErrorState
          message={teams.error}
          hint="اضغط لإعادة المحاولة."
          onRetry={() => void teams.reload()}
        />
      ) : null}

      {teams.myState && !teams.myState.hasEligibleSection ? (
        <Callout
          tone="warning"
          icon={AlertTriangle}
          title={sectionId ? 'الشعبة المختارة غير متاحة' : 'تحتاج إلى شعبة مسجّلة'}
          message={
            sectionId
              ? 'الشعبة التي اخترتها في تبويب «نظرة عامة» غير مسجّلة في تسجيلك لهذا المقرر. اختر شعبة أخرى.'
              : 'اختر شعبة لهذا المقرر في تبويب «نظرة عامة» قبل إنشاء فريق أو الانضمام إليه.'
          }
        />
      ) : null}

      <ChipRow className="-mx-6">
        <Chip
          label="استعراض الفرق"
          active={mode === 'browse'}
          onPress={() => setMode('browse')}
        />
        <Chip
          label="إنشاء فريق"
          active={mode === 'create'}
          disabled={!teams.myState?.hasEligibleSection || Boolean(teams.myState?.team)}
          onPress={() => setMode('create')}
        />
      </ChipRow>

      {mode === 'create' ? (
        <CreateTeamForm
          catalog={catalog}
          subjectId={subjectId}
          semesterId={semesterId}
          sections={sections}
          preferredSectionId={sectionId}
          busy={busy}
          onCancel={() => setMode('browse')}
          onSubmit={(input) =>
            run(async () => {
              await teams.createTeam(input);
              setMode('browse');
            }, 'create-team')
          }
        />
      ) : (
        <BrowseView
          teams={teams.teams}
          loading={teams.loading}
          myState={teams.myState}
          sectionId={sectionId}
          busy={busy}
          onOpen={(teamId) => run(() => teams.openTeam(teamId), 'open-team')}
          onRefresh={() => void teams.reload()}
        />
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Browse                                                                      */
/* -------------------------------------------------------------------------- */

function BrowseView({
  teams,
  loading,
  myState,
  sectionId,
  busy,
  onOpen,
  onRefresh,
}: {
  teams: SubjectTeamSummary[];
  loading: boolean;
  myState: ReturnType<typeof useSubjectTeams>['myState'];
  /** The student's selected section, when any. */
  sectionId: string | null;
  busy: boolean;
  onOpen: (teamId: string) => void;
  onRefresh: () => void;
}) {
  const colors = useThemeColors();

  return (
    <View className="gap-3">
      {myState?.team ? (
        <Card tone="accent" className="gap-3">
          <View className="flex-row items-center gap-2">
            <View className="flex-1 items-end gap-0.5">
              <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                فريقي في هذا المقرر
              </Text>
              <Text className="text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                اضغط على الفريق لمتابعة المهام وطلبات الانضمام.
              </Text>
            </View>
            <Users color={colors.accent} size={18} />
          </View>
          <TeamCard team={myState.team} highlight onPress={() => onOpen(myState.team!.id)} />
          {myState.pendingRequest ? (
            <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
              لديك طلب انضمام معلّق في هذا المقرر. لا يمكنك الانضمام لفريق آخر حتى يُحسم.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {myState?.pendingRequest && !myState.team ? (
        <Callout
          tone="info"
          title="طلب انضمام قيد المراجعة"
          message="ينتظر قرار منشئ الفريق. يمكنك إلغاؤه من صفحة الفريق."
        />
      ) : null}

      <View className="flex-row items-center gap-2">
        <IconButton
          icon={RefreshCw}
          label="تحديث قائمة الفرق"
          size={18}
          onPress={onRefresh}
          disabled={busy}
        />
        <View className="flex-1 items-end gap-0.5">
          <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
            فرق متاحة للانضمام
          </Text>
          <Text className="text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {loading ? 'جارٍ التحميل...' : `${teams.length} فريقًا ظاهرًا لك`}
          </Text>
        </View>
      </View>

      {loading ? (
        <LoadingState label="جارٍ تحميل الفرق..." />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا توجد فرق ظاهرة"
          description={
            myState?.hasEligibleSection
              ? 'يمكنك إنشاء فريقك الأول لهذا المقرر.'
              : sectionId
                ? 'لا توجد فرق متاحة لشعبتك المختارة. جرّب شعبة أخرى من تبويب «نظرة عامة».'
                : 'اختر شعبة أولًا لعرض الفرق المتاحة.'
          }
        />
      ) : (
        teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            disabled={busy}
            onPress={() => onOpen(team.id)}
          />
        ))
      )}
    </View>
  );
}

function TeamCard({
  team,
  onPress,
  highlight = false,
  disabled = false,
}: {
  team: SubjectTeamSummary;
  onPress: () => void;
  highlight?: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel={team.name}
      onPress={onPress}
      disabled={disabled}
      tone={highlight ? 'accent' : 'default'}
      className="gap-1.5"
    >
      <Text className="text-right text-sm font-semibold leading-5 text-slate-900 dark:text-white">
        {team.name}
      </Text>
      {team.description ? (
        <Text
          className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400"
          numberOfLines={2}
        >
          {team.description}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {team.memberCount}/{team.maxMembers} أعضاء
        </Text>
        <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {team.openSlotCount} مهمة متاحة
        </Text>
        <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {SCOPE_LABELS[team.scope]}
        </Text>
        {team.sectionCode ? (
          <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            شعبة {team.sectionCode}
          </Text>
        ) : null}
      </View>
      <Text className="text-right text-[11px] leading-4 text-slate-400 dark:text-slate-500">
        أنشأه {team.creatorName}
      </Text>
    </PressableCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

function TeamDetailView({
  team,
  requests,
  busy,
  onBack,
  onOpenContact,
  onRequestJoin,
  onDecide,
  onCancelMine,
  onDeleteTeam,
  onLeaveTeam,
  onEdit,
}: {
  team: SubjectTeamDetail;
  requests: CreatorJoinRequest[];
  busy: boolean;
  onBack: () => void;
  onOpenContact: (
    method: SubjectTeamContactMethod | null,
    value: string | null,
    withDefaultMessage: boolean,
  ) => void;
  onRequestJoin: (slotId: string, message?: string) => void;
  onDecide: (requestId: string, approve: boolean) => void;
  onCancelMine: (requestId: string) => void;
  /** Deletes the team — offered to the creator only. */
  onDeleteTeam: (team: SubjectTeamDetail) => Promise<void>;
  /** Leaves the team — offered to a member who did not create it. */
  onLeaveTeam: (team: SubjectTeamDetail) => Promise<void>;
  onEdit: (input: {
    description?: string;
    contactMethod?: SubjectTeamContactMethod;
    contactValue?: string;
    taskSlots?: { id: string; taskDescription: string }[];
  }) => Promise<boolean>;
}) {
  const colors = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  // The destructive actions run their own request, so they carry their own
  // "in flight" state: the button shows what it is doing instead of silently
  // disabling itself, and a second tap cannot start a second deletion.
  const [destroying, setDestroying] = useState(false);

  const runDestructive = async (action: () => Promise<void>) => {
    if (destroying) {
      return;
    }
    setDestroying(true);
    try {
      await action();
    } finally {
      setDestroying(false);
    }
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <IconButton icon={X} label="إغلاق تفاصيل الفريق" size={18} onPress={onBack} />
        <View className="flex-1 items-end gap-0.5">
          <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
            تفاصيل الفريق
          </Text>
          <Text className="text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {team.memberCount}/{team.maxMembers} أعضاء • {SCOPE_LABELS[team.scope]}
          </Text>
        </View>
      </View>

      <Card className="gap-1.5">
        <Text className="text-right text-base font-bold leading-6 text-slate-900 dark:text-white">
          {team.name}
        </Text>
        {team.description ? (
          <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
            {team.description}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {team.memberCount}/{team.maxMembers} أعضاء
          </Text>
          <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {SCOPE_LABELS[team.scope]}
          </Text>
          {team.professorName ? (
            <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              {team.professorName}
            </Text>
          ) : null}
          {team.sectionCode ? (
            <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              شعبة {team.sectionCode}
            </Text>
          ) : null}
        </View>
      </Card>

      {team.viewer.isCreator || team.viewer.isMember ? (
        team.contactValue ? (
          <Card className="gap-2">
            <View className="flex-row items-center gap-2">
              <View className="flex-1 items-end gap-0.5">
                <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                  التواصل خارج التطبيق
                </Text>
                <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {team.contactMethod ? CONTACT_LABELS[team.contactMethod] : ''} —{' '}
                  {team.contactValue}
                </Text>
              </View>
              <MessageCircle color={colors.slate500} size={18} />
            </View>
            <Button
              label="فتح المحادثة"
              variant="secondary"
              icon={MessageCircle}
              onPress={() => onOpenContact(team.contactMethod, team.contactValue, true)}
            />
          </Card>
        ) : (
          <Callout tone="neutral" message="لا توجد طريقة تواصل مسجّلة لهذا الفريق." />
        )
      ) : (
        <Callout
          tone="neutral"
          message="تظهر بيانات التواصل بعد قبول انضمامك إلى الفريق."
        />
      )}

      <Card className="gap-3">
        <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
          المهام والشواغر
        </Text>
        {team.slots.map((slot) => {
          const mine = team.viewer.membershipSlotId === slot.id;
          const requested = team.viewer.pendingRequestSlotId === slot.id;
          const reserved =
            team.viewer.isCreator && slot.pendingRequestStudentId !== null && slot.state === 'OPEN';
          return (
            <View
              key={slot.id}
              className="gap-1.5 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"
            >
              <View className="flex-row items-center gap-2">
                <Badge
                  label={slot.state === 'JOINED' ? 'مشغول' : 'متاح'}
                  tone={slot.state === 'JOINED' ? 'success' : 'neutral'}
                />
                <Text className="flex-1 text-right text-xs leading-5 text-slate-700 dark:text-slate-200">
                  {slot.position}. {slot.taskDescription}
                </Text>
              </View>
              {slot.memberName ? (
                <Text className="text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {mine ? 'أنت' : slot.memberName}
                </Text>
              ) : null}
              {reserved ? (
                <Text className="text-right text-[11px] leading-4 text-amber-700 dark:text-amber-400">
                  يوجد طلب معلّق على هذه المهمة.
                </Text>
              ) : null}
              {!team.viewer.isCreator &&
              !team.viewer.isMember &&
              slot.state === 'OPEN' &&
              !team.viewer.pendingRequestId ? (
                <>
                  <TextField
                    value={message}
                    onChangeText={setMessage}
                    placeholder="رسالة اختيارية للمنشئ"
                    maxLength={500}
                  />
                  <Button
                    label={requested ? 'تم إرسال الطلب' : 'طلب الانضمام لهذه المهمة'}
                    loading={busy}
                    disabled={requested}
                    onPress={() => onRequestJoin(slot.id, message)}
                  />
                </>
              ) : null}
            </View>
          );
        })}
      </Card>

      {team.viewer.pendingRequestId && !team.viewer.isMember ? (
        <Button
          label="إلغاء طلبي"
          variant="outline"
          onPress={() => onCancelMine(team.viewer.pendingRequestId!)}
          disabled={busy}
        />
      ) : null}

      {team.members.length > 0 ? (
        <Card className="gap-2">
          <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
            الأعضاء
          </Text>
          {team.members.map((member) => (
            <View key={member.userId} className="flex-row items-center gap-2">
              <Badge
                label={member.role === 'OWNER' ? 'منشئ' : 'عضو'}
                tone={member.role === 'OWNER' ? 'brand' : 'neutral'}
              />
              <Text className="flex-1 text-right text-sm leading-6 text-slate-900 dark:text-white">
                {member.userId === team.creatorId ? `${member.fullName} (أنت)` : member.fullName}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {team.viewer.isMember && !team.viewer.isCreator ? (
        <Button
          label={destroying ? 'جارٍ مغادرة الفريق...' : 'مغادرة الفريق'}
          icon={UserMinus}
          variant="outline"
          loading={destroying}
          disabled={busy || destroying}
          onPress={() => void runDestructive(() => onLeaveTeam(team))}
        />
      ) : null}

      {team.viewer.isCreator ? (
        <>
          <Card className="gap-3">
            <View className="flex-row items-center gap-2">
              <View className="flex-1 items-end gap-0.5">
                <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                  طلبات الانضمام
                </Text>
                <Text className="text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {requests.length === 0 ? 'لا توجد طلبات معلّقة.' : `${requests.length} طلبًا معلّقًا`}
                </Text>
              </View>
              <Badge
                label={String(requests.length)}
                tone={requests.length > 0 ? 'warning' : 'neutral'}
              />
            </View>
            {requests.length === 0 ? null : (
              requests.map((request) => (
                <View
                  key={request.id}
                  className="gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                      مهمة {request.slotPosition ?? '-'}
                    </Text>
                    <Text className="flex-1 text-right text-sm leading-6 text-slate-900 dark:text-white">
                      {request.studentName}
                    </Text>
                  </View>
                  {request.message ? (
                    <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {request.message}
                    </Text>
                  ) : null}
                  <View className="flex-row gap-2">
                    <Button
                      label="رفض"
                      variant="secondary"
                      fullWidth={false}
                      className="flex-1"
                      disabled={busy}
                      onPress={() => onDecide(request.id, false)}
                    />
                    <Button
                      label="قبول"
                      fullWidth={false}
                      className="flex-1"
                      disabled={busy}
                      onPress={() => onDecide(request.id, true)}
                    />
                  </View>
                </View>
              ))
            )}
          </Card>

          {editing ? (
            <EditTeamForm
              team={team}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSubmit={async (input) => {
                // Keep the form open until the save actually succeeds, so a
                // failed or timed-out edit does not silently discard the
                // student's input and re-show the stale team.
                const ok = await onEdit(input);
                if (ok) {
                  setEditing(false);
                }
              }}
            />
          ) : (
            <Button
              label="تعديل الفريق"
              icon={Pencil}
              variant="secondary"
              onPress={() => setEditing(true)}
            />
          )}

          {/* Creator-only: deleting the team takes every member with it. */}
          <Button
            label={destroying ? 'جارٍ حذف الفريق...' : 'حذف الفريق'}
            icon={Trash2}
            variant="danger"
            loading={destroying}
            disabled={busy || destroying}
            onPress={() => void runDestructive(() => onDeleteTeam(team))}
          />
        </>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Create / Edit forms                                                         */
/* -------------------------------------------------------------------------- */

function CreateTeamForm({
  catalog,
  subjectId,
  semesterId,
  sections,
  preferredSectionId,
  busy,
  onCancel,
  onSubmit,
}: {
  catalog: Catalog;
  subjectId: string;
  semesterId: string;
  sections: CatalogSection[];
  preferredSectionId: string | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    name: string;
    description?: string;
    subjectId: string;
    sectionId: string;
    semesterId: string;
    scope: SubjectTeamScope;
    maxMembers: number;
    taskSlots: { taskDescription: string }[];
    contactMethod: SubjectTeamContactMethod;
    contactValue: string;
  }) => void;
}) {
  const sectionOptions: SelectOption[] = useMemo(
    () =>
      sections.map((section) => ({
        value: section.id,
        label: `شعبة ${section.code}`,
      })),
    [sections],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // The section the form creates the team for. It follows the student's current
  // selection (the single source of truth) and only differs when the student
  // explicitly picks another section here — and only for as long as the
  // selection it was made against has not changed.
  const [sectionChoice, setSectionChoice] = useState<{ base: string; value: string } | null>(
    null,
  );
  const [scope, setScope] = useState<SubjectTeamScope>('SECTION');
  const [maxMembers, setMaxMembers] = useState('3');
  const [tasks, setTasks] = useState<string[]>(['', '', '']);
  const [contactMethod, setContactMethod] = useState<SubjectTeamContactMethod>('TELEGRAM');
  const [contactValue, setContactValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // A selection the catalog does not know (a stale pick) is no selection at all.
  const preferred = resolveSelectedSectionId(preferredSectionId, sections) ?? '';
  const chosenSection =
    sectionChoice && sectionChoice.base === preferred ? sectionChoice.value : preferred;
  const chooseSection = (value: string) => setSectionChoice({ base: preferred, value });

  const adjustSize = (next: number) => {
    const clamped = Math.max(2, Math.min(20, next));
    setMaxMembers(String(clamped));
    setTasks((current) => {
      const copy = current.slice(0, clamped);
      while (copy.length < clamped) {
        copy.push('');
      }
      return copy;
    });
  };

  const submit = () => {
    setFormError(null);
    const size = Number.parseInt(maxMembers, 10);
    if (!name.trim() || name.trim().length < 2) {
      setFormError('اسم الفريق مطلوب (حرفان على الأقل).');
      return;
    }
    if (!chosenSection) {
      setFormError('اختر شعبتك لهذا المقرر.');
      return;
    }
    if (!Number.isInteger(size) || size < 2 || size > 20) {
      setFormError('عدد الأعضاء يجب أن يكون بين 2 و 20.');
      return;
    }
    if (tasks.length !== size || tasks.some((task) => task.trim().length < 2)) {
      setFormError('اكتب مهمة لكل عضو (حرفان على الأقل لكل مهمة).');
      return;
    }
    if (!contactValue.trim()) {
      setFormError('أدخل بيانات التواصل.');
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      subjectId,
      sectionId: chosenSection,
      semesterId,
      scope,
      maxMembers: size,
      taskSlots: tasks.map((task) => ({ taskDescription: task.trim() })),
      contactMethod,
      contactValue: contactValue.trim(),
    });
  };

  return (
    <Card className="gap-3">
      <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
        إنشاء فريق جديد
      </Text>
      <TextField label="اسم الفريق" value={name} onChangeText={setName} maxLength={120} />
      <TextField
        label="وصف (اختياري)"
        value={description}
        onChangeText={setDescription}
        maxLength={1000}
      />
      <SelectField
        label="شعبتك"
        value={chosenSection}
        options={sectionOptions}
        onSelect={chooseSection}
        placeholder="اختر شعبتك"
        emptyText="لا توجد شعب متاحة لهذا المقرر."
      />
      <SelectField
        label="نطاق الظهور"
        value={scope}
        options={SCOPE_OPTIONS}
        onSelect={(value) => setScope(value as SubjectTeamScope)}
      />
      <SelectField
        label="عدد الأعضاء (يشمل المنشئ)"
        value={maxMembers}
        options={[2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: `${n} أعضاء` }))}
        onSelect={(value) => adjustSize(Number.parseInt(value, 10))}
      />
      <View className="gap-2">
        <Text className="text-right text-sm font-medium text-slate-700 dark:text-slate-300">
          مهام الأعضاء
        </Text>
        {tasks.map((task, index) => (
          <TextField
            key={`team-task-${index}`}
            label={index === 0 ? 'مهمتك (المنشئ)' : `مهمة العضو ${index + 1}`}
            value={task}
            onChangeText={(text) =>
              setTasks((current) => current.map((value, i) => (i === index ? text : value)))
            }
            maxLength={200}
          />
        ))}
      </View>
      <SelectField
        label="طريقة التواصل"
        value={contactMethod}
        options={CONTACT_OPTIONS}
        onSelect={(value) => setContactMethod(value as SubjectTeamContactMethod)}
      />
      <TextField
        label={CONTACT_LABELS[contactMethod]}
        value={contactValue}
        onChangeText={setContactValue}
        placeholder={CONTACT_PLACEHOLDERS[contactMethod]}
        autoCapitalize="none"
        textAlign="left"
        maxLength={300}
      />
      <Text className="text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        تظهر بيانات التواصل للأعضاء المقبولين فقط، ولا تُعرض لبقية الطلاب.
      </Text>
      {formError ? <Callout tone="danger" message={formError} /> : null}
      <View className="flex-row gap-2">
        <Button
          label="إلغاء"
          variant="secondary"
          fullWidth={false}
          className="flex-1"
          onPress={onCancel}
          disabled={busy}
        />
        <Button
          label="إنشاء"
          fullWidth={false}
          className="flex-1"
          loading={busy}
          onPress={submit}
        />
      </View>
    </Card>
  );
}

function EditTeamForm({
  team,
  busy,
  onCancel,
  onSubmit,
}: {
  team: SubjectTeamDetail;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    description?: string;
    contactMethod?: SubjectTeamContactMethod;
    contactValue?: string;
    taskSlots?: { id: string; taskDescription: string }[];
  }) => void;
}) {
  const [description, setDescription] = useState(team.description ?? '');
  const [contactMethod, setContactMethod] = useState<SubjectTeamContactMethod>(
    team.contactMethod ?? 'TELEGRAM',
  );
  const [contactValue, setContactValue] = useState(team.contactValue ?? '');
  const [tasks, setTasks] = useState(team.slots.map((slot) => slot.taskDescription));
  const [formError, setFormError] = useState<string | null>(null);

  const submit = () => {
    setFormError(null);
    const slots: { id: string; taskDescription: string }[] = [];
    for (let index = 0; index < team.slots.length; index += 1) {
      const slot = team.slots[index]!;
      const text = tasks[index] ?? '';
      // A joined slot's task is immutable: submit it unchanged so the backend
      // accepts the payload without the UI ever pretending it can edit it.
      if (slot.state === 'JOINED') {
        slots.push({ id: slot.id, taskDescription: slot.taskDescription });
        continue;
      }
      if (text.trim().length < 2) {
        setFormError('كل مهمة غير مشغولة يجب أن تحتوي حرفين على الأقل.');
        return;
      }
      slots.push({ id: slot.id, taskDescription: text.trim() });
    }
    if (!contactValue.trim()) {
      setFormError('أدخل بيانات التواصل.');
      return;
    }
    onSubmit({
      description: description.trim(),
      contactMethod,
      contactValue: contactValue.trim(),
      taskSlots: slots,
    });
  };

  return (
    <Card className="gap-3">
      <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
        تعديل الفريق
      </Text>
      <Text className="text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        لا يمكن تغيير المقرر أو الفصل أو الشعبة أو المنشئ. مهام الأعضاء المنضمّين غير قابلة للتعديل.
      </Text>
      <TextField
        label="وصف"
        value={description}
        onChangeText={setDescription}
        maxLength={1000}
      />
      <View className="gap-2">
        <Text className="text-right text-sm font-medium text-slate-700 dark:text-slate-300">
          المهام
        </Text>
        {team.slots.map((slot, index) => (
          <TextField
            key={slot.id}
            label={`مهمة ${slot.position}${slot.state === 'JOINED' ? ' (مشغولة)' : ''}`}
            value={tasks[index] ?? ''}
            editable={slot.state !== 'JOINED'}
            onChangeText={(text) =>
              setTasks((current) => current.map((value, i) => (i === index ? text : value)))
            }
            maxLength={200}
          />
        ))}
      </View>
      <SelectField
        label="طريقة التواصل"
        value={contactMethod}
        options={CONTACT_OPTIONS}
        onSelect={(value) => setContactMethod(value as SubjectTeamContactMethod)}
      />
      <TextField
        label={CONTACT_LABELS[contactMethod]}
        value={contactValue}
        onChangeText={setContactValue}
        autoCapitalize="none"
        textAlign="left"
        maxLength={300}
      />
      {formError ? <Callout tone="danger" message={formError} /> : null}
      <View className="flex-row gap-2">
        <Button
          label="إلغاء"
          variant="secondary"
          fullWidth={false}
          className="flex-1"
          onPress={onCancel}
          disabled={busy}
        />
        <Button label="حفظ" fullWidth={false} className="flex-1" loading={busy} onPress={submit} />
      </View>
    </Card>
  );
}

/** Re-exported so the tab keeps a single entry point in `course/[id].tsx`. */
export { TeamsPanel as SubjectTeamsPanel };

