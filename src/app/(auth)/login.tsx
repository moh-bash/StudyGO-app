import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth/AuthContext";
import { mapAuthError } from "@/lib/auth/errors";
import { validateEmail, validateLoginPassword } from "@/lib/auth/validation";
import { router } from "expo-router";
import { LockKeyhole, Mail } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const emailError = validateEmail(email);
    const passwordError = validateLoginPassword(password);
    setFieldErrors({ email: emailError ?? undefined, password: passwordError ?? undefined });
    if (emailError || passwordError) {
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // The route guard in `app/_layout.tsx` swaps to the app once the session
      // status flips to authenticated; no manual navigation is needed here.
    } catch (cause) {
      setError(mapAuthError(cause, "login"));
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
              <Text className="text-3xl font-bold text-slate-900 dark:text-white">مرحبًا بعودتك</Text>
              <Text className="text-base text-slate-500 dark:text-slate-400">
                سجّل الدخول لمتابعة رحلتك التعليمية.
              </Text>
            </View>
            <View className="gap-4">
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
                placeholder="أدخل كلمة المرور"
                secureTextEntry
                showToggle
                textContentType="password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setFieldErrors((previous) => ({ ...previous, password: undefined }));
                }}
                error={fieldErrors.password}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
              <Button label="تسجيل الدخول" loading={loading} onPress={handleLogin} />
            </View>
            <View className="flex-row items-center justify-center gap-1 pt-4">
              <Text className="text-sm text-slate-500 dark:text-slate-400">ليس لديك حساب؟</Text>
              <Pressable onPress={() => router.push("/(auth)/sign-up")} hitSlop={8}>
                <Text className="text-sm font-semibold text-brand-600 dark:text-brand-400">إنشاء حساب</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
