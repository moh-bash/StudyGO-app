import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ScreenPlaceholder } from "@/components/ui/screen-placeholder";
import { useThemeColors } from "@/constants/theme";
import { useOnboarding } from "@/features/onboarding/onboarding-provider";
import { useStudyPlan } from "@/features/courses/use-study-plan";
import { useAuth } from "@/lib/auth/AuthContext";
import { parseBackup, planImport, serializeBackup, type BackupFile, type ImportMode } from "@/lib/backup/backup";
import { pickBackupFileText, shareBackupFile } from "@/lib/backup/backup-file";
import { Download, LogOut, RotateCcw, ShieldCheck, Upload, UserRound } from "lucide-react-native";
import { useState } from "react";
import { Alert, Text, View } from "react-native";

export default function AccountScreen() {
  const { user, status, isLocalOnly, signOut } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { entries, loading: planLoading, importPlan, reload } = useStudyPlan();
  const colors = useThemeColors();
  const [signingOut, setSigningOut] = useState(false);
  const [backupBusy, setBackupBusy] = useState<"export" | "import" | null>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const handleExport = async () => {
    setBackupBusy("export");
    try {
      await shareBackupFile(serializeBackup(entries));
    } catch (e) {
      Alert.alert("تعذّر التصدير", e instanceof Error ? e.message : "حدث خطأ غير متوقع.");
    } finally {
      setBackupBusy(null);
    }
  };

  const runImport = async (backup: BackupFile, mode: ImportMode) => {
    setBackupBusy("import");
    try {
      const plan = planImport(entries, backup, mode);
      if (plan.entries.length === 0) {
        Alert.alert("لا يوجد جديد", "كل سجلات الملف موجودة في خطتك بالفعل.");
        return;
      }
      const result = await importPlan(plan);
      await reload();
      Alert.alert(
        "تم الاستيراد",
        mode === "replace"
          ? `تم استبدال خطة هذا الحساب بـ ${result.imported} مقررًا.`
          : `تمت إضافة ${result.imported} مقررًا، وتخطي ${plan.skipped} سجلًا موجودًا.`,
      );
    } catch (e) {
      Alert.alert("تعذّر الاستيراد", e instanceof Error ? e.message : "حدث خطأ غير متوقع.");
    } finally {
      setBackupBusy(null);
    }
  };

  const handleImport = async () => {
    setBackupBusy("import");
    try {
      const text = await pickBackupFileText();
      if (text === null) {
        return;
      }
      const parsed = parseBackup(text);
      if (!parsed.ok) {
        Alert.alert("ملف غير صالح", parsed.error);
        return;
      }
      const count = parsed.backup.entries.length;
      Alert.alert(
        "استيراد الخطة",
        `يحتوي الملف على ${count} سجلًا. اختر "دمج" لإضافة السجلات غير الموجودة فقط، أو "استبدال" لحذف خطة هذا الحساب الحالية واستخدام خطة الملف.`,
        [
          { text: "إلغاء", style: "cancel" },
          { text: "دمج", onPress: () => void runImport(parsed.backup, "merge") },
          {
            text: "استبدال خطتي",
            style: "destructive",
            onPress: () => void runImport(parsed.backup, "replace"),
          },
        ],
      );
    } catch (e) {
      Alert.alert("تعذّر الاستيراد", e instanceof Error ? e.message : "حدث خطأ غير متوقع.");
    } finally {
      setBackupBusy(null);
    }
  };

  if (!user) {
    return (
      <Screen topInset={false}>
        <ScreenPlaceholder title="الإعدادات" subtitle="تعذّر تحميل بيانات الحساب." />
      </Screen>
    );
  }

  const busy = backupBusy !== null;

  return (
    // The tab navigator above already applies the top safe-area inset.
    <Screen topInset={false}>
      <ScreenHeader title="الإعدادات" subtitle="حسابك وبياناتك على هذا الجهاز." />

      <ScreenScroll tabBar className="px-6" contentClassName="gap-4 pb-4">
        <Card className="items-center gap-3 py-5">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-50 dark:bg-slate-800">
            <UserRound color={colors.accent} size={36} />
          </View>
          <View className="items-center gap-1">
            <Text className="text-center text-xl font-bold leading-7 text-slate-900 dark:text-white">
              {user.fullName}
            </Text>
            <Text className="text-center text-sm text-slate-500 dark:text-slate-400">{user.email}</Text>
          </View>
          {isLocalOnly ? (
            <Badge
              label={
                status === "server-error"
                  ? "وضع محلي — الخادم يواجه خللًا"
                  : "وضع دون اتصال — تُعرض البيانات المحفوظة"
              }
              tone="warning"
            />
          ) : (
            <Badge label="متصل بالخادم" tone="success" />
          )}
        </Card>

        <Card className="gap-3">
          <View className="flex-row items-start gap-2">
            <View className="flex-1 items-end gap-0.5">
              <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                النسخ الاحتياطي المحلي
              </Text>
              <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
                صدّر خطتك وعلاماتك كملف JSON، أو استوردها على هذا الجهاز. لا تُرسل إلى أي خادم.
              </Text>
            </View>
            <ShieldCheck color={colors.success} size={20} />
          </View>

          <View className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <Text className="text-right text-xs leading-5 text-slate-600 dark:text-slate-300">
              {planLoading
                ? "جارٍ تحميل خطتك المحلية..."
                : `${entries.length} مقررًا محفوظًا في خطة هذا الحساب.`}
            </Text>
          </View>

          <Button
            label="تصدير نسخة احتياطية"
            icon={Download}
            variant="primary"
            loading={backupBusy === "export"}
            disabled={busy || planLoading}
            onPress={() => void handleExport()}
          />
          <Button
            label="استيراد نسخة احتياطية"
            icon={Upload}
            variant="outline"
            loading={backupBusy === "import"}
            disabled={busy || planLoading}
            onPress={() => void handleImport()}
          />

          <Text className="text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            الاستيراد يتحقق من الملف بالكامل قبل الكتابة. الدمج لا يحذف أي مقرر موجود، والاستبدال
            يحذف خطة هذا الحساب فقط بعد تأكيدك. تبقى خطط الحسابات الأخرى على الجهاز كما هي.
          </Text>
        </Card>

        <View className="gap-2">
          <Button
            label="تسجيل الخروج"
            icon={LogOut}
            variant="danger"
            loading={signingOut}
            disabled={signingOut || status === "unauthenticated"}
            onPress={() => void handleSignOut()}
          />
          <Button
            label="إعادة الإعداد التعريفي (تجريبي)"
            icon={RotateCcw}
            variant="outline"
            onPress={resetOnboarding}
          />
        </View>
      </ScreenScroll>
    </Screen>
  );
}
