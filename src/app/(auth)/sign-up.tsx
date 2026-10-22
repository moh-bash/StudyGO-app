import { BrandLockup } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { SelectField, type SelectOption } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { programsApi } from "@/lib/api/programs";
import type { RegistrationProgram } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthContext";
import { mapAuthError } from "@/lib/auth/errors";
import { validateEmail, validateFullName, validatePassword, validatePhone } from "@/lib/auth/validation";
import { router } from "expo-router";
import { AlertCircle, GraduationCap, LockKeyhole, Mail, Phone, User } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
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
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
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
    const phoneError = validatePhone(phone);
    const programError = programId
      ? undefined
      : programsError
        ? programsError
        : "الرجاء اختيار البرنامج الأكاديمي";

    setFieldErrors({
      fullName: nameError ?? undefined,
      email: emailError ?? undefined,
      password: passwordError ?? undefined,
      phone: phoneError ?? undefined,
      programId: programError,
    });
    if (nameError || emailError || passwordError || phoneError || programError || !programId) {
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const trimmedPhone = phone.trim();
      await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
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
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        // On Android the window already resizes for the keyboard
        // (`adjustResize`), and `behavior="height"` there fights with it.
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScreenScroll
          className="px-6"
          contentContainerStyle={{ flexGrow: 1 }}
          contentClassName="gap-8 pt-4"
        >
          <View className="flex-1 justify-center gap-8">
            <View className="gap-6">
              <BrandLockup />
              <View className="gap-2">
                <Text className="text-right text-3xl font-bold leading-9 text-slate-900 dark:text-white">
                  أنشئ حسابك
                </Text>
                <Text className="text-right text-base leading-6 text-slate-500 dark:text-slate-400">
                  ابدأ مع StudyGo ونظّم رحلتك التعليمية.
                </Text>
              </View>
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
                textAlign="left"
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
                hint="8 أحرف على الأقل، وتحتوي على حرف ورقم."
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setFieldErrors((previous) => ({ ...previous, password: undefined }));
                }}
                error={fieldErrors.password}
                returnKeyType="next"
              />
              <TextField
                label="رقم الهاتف (اختياري)"
                icon={Phone}
                placeholder="مثال: 05xxxxxxxx"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                textAlign="left"
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  setFieldErrors((previous) => ({ ...previous, phone: undefined }));
                }}
                error={fieldErrors.phone}
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إعادة تحميل البرامج"
                  onPress={() => void retryPrograms()}
                  hitSlop={8}
                  className="self-end"
                >
                  <Text className="text-sm font-semibold text-brand-700 dark:text-brand-400">
                    إعادة تحميل البرامج
                  </Text>
                </Pressable>
              ) : null}
              <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
                بإنشاء الحساب، فإنك توافق على شروط الاستخدام وسياسة الخصوصية.
              </Text>
              {error ? (
                <Callout tone="danger" icon={AlertCircle} message={error} />
              ) : null}
              <Button label="إنشاء الحساب" loading={loading} onPress={() => void handleSignUp()} />
            </View>

            <View className="flex-row items-center justify-center gap-1 pt-2">
              <Text className="text-sm text-slate-500 dark:text-slate-400">لديك حساب بالفعل؟</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="تسجيل الدخول"
                onPress={() => router.push("/(auth)/login")}
                hitSlop={8}
              >
                <Text className="text-sm font-semibold text-brand-700 dark:text-brand-400">
                  تسجيل الدخول
                </Text>
              </Pressable>
            </View>
          </View>
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
