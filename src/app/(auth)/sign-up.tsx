import { Button } from "@/components/ui/button";
import { SelectField, type SelectOption } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { programsApi } from "@/lib/api/programs";
import type { RegistrationProgram } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthContext";
import { mapAuthError } from "@/lib/auth/errors";
import { validateEmail, validateFullName, validatePassword } from "@/lib/auth/validation";
import { router } from "expo-router";
import { GraduationCap, LockKeyhole, Mail, User } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  programId?: string;
};

function toOptions(programs: RegistrationProgram[]): SelectOption[] {
  return programs.map((program) => ({
    value: program.id,
    label: program.name,
    hint: program.code,
  }));
}

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [programId, setProgramId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<RegistrationProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch the program list on mount. State is only written after the network
  // call resolves, and `active` guards against writes after unmount.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await programsApi.registration();
        if (!active) return;
        setPrograms(list);
        setProgramsError(null);
      } catch (cause) {
        if (!active) return;
        setProgramsError(mapAuthError(cause, "register"));
      } finally {
        if (active) setProgramsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const retryPrograms = useCallback(async () => {
    setProgramsLoading(true);
    setProgramsError(null);
    try {
      setPrograms(await programsApi.registration());
    } catch (cause) {
      setProgramsError(mapAuthError(cause, "register"));
    } finally {
      setProgramsLoading(false);
    }
  }, []);

  const handleSignUp = async () => {
    const nameError = validateFullName(fullName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const programError = programId
      ? undefined
      : programsError
        ? programsError
        : "الرجاء اختيار البرنامج الأكاديمي";

    setFieldErrors({
      fullName: nameError ?? undefined,
      email: emailError ?? undefined,
      password: passwordError ?? undefined,
      programId: programError,
    });
    if (nameError || emailError || passwordError || programError || !programId) {
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        programId,
      });
      // The route guard in `app/_layout.tsx` redirects to the app once the
      // session status flips; no manual navigation is needed here.
    } catch (cause) {
      setError(mapAuthError(cause, "register"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 24),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center gap-8">
            <View className="gap-2">
              <Text className="text-3xl font-bold text-slate-900 dark:text-white">
                أنشئ حسابك
              </Text>
              <Text className="text-base text-slate-500 dark:text-slate-400">
                ابدأ مع StudyGo ونظّم رحلتك التعليمية.
              </Text>
            </View>
            <View className="gap-4">
              <TextField
                label="الاسم الكامل"
                icon={User}
                placeholder="مثال: أحمد محمد"
                autoCorrect={false}
                textContentType="name"
                value={fullName}
                onChangeText={(value) => {
                  setFullName(value);
                  setFieldErrors((previous) => ({ ...previous, fullName: undefined }));
                }}
                error={fieldErrors.fullName}
                returnKeyType="next"
              />
              <TextField
                label="البريد الإلكتروني"
                icon={Mail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setFieldErrors((previous) => ({ ...previous, email: undefined }));
                }}
                error={fieldErrors.email}
                returnKeyType="next"
              />
              <TextField
                label="كلمة المرور"
                icon={LockKeyhole}
                placeholder="أنشئ كلمة مرور"
                secureTextEntry
                showToggle
                textContentType="newPassword"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setFieldErrors((previous) => ({ ...previous, password: undefined }));
                }}
                error={fieldErrors.password}
                returnKeyType="next"
              />
              <SelectField
                label="البرنامج الأكاديمي"
                placeholder="اختر برنامجك"
                icon={GraduationCap}
                value={programId}
                options={toOptions(programs)}
                onSelect={(value) => {
                  setProgramId(value);
                  setFieldErrors((previous) => ({ ...previous, programId: undefined }));
                }}
                loading={programsLoading}
                error={fieldErrors.programId}
                disabled={programsLoading}
                emptyText="لا توجد برامج متاحة حاليًا."
              />
              {programsError && !programId ? (
                <Pressable onPress={retryPrograms} hitSlop={8}>
                  <Text className="text-sm font-medium text-brand-600 dark:text-brand-400">
                    إعادة تحميل البرامج
                  </Text>
                </Pressable>
              ) : null}
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                بإنشاء الحساب، فإنك توافق على شروط الاستخدام وسياسة الخصوصية.
              </Text>
              {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
              <Button label="إنشاء الحساب" loading={loading} onPress={handleSignUp} />
            </View>
            <View className="flex-row items-center justify-center gap-1 pt-4">
              <Text className="text-sm text-slate-500 dark:text-slate-400">
                لديك حساب بالفعل؟
              </Text>
              <Pressable onPress={() => router.push("/(auth)/login")} hitSlop={8}>
                <Text className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                  تسجيل الدخول
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
