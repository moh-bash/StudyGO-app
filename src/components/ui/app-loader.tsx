import { ActivityIndicator, Text, View } from 'react-native';
import { palette } from '@/constants/theme';

/**
 * Branded boot loader shown while the stored onboarding flag and the session are
 * being resolved. It matches the native splash screen (same brand background) so
 * the hand-off from splash to the first real screen is seamless and no routing
 * screen can flash in between.
 */
export function AppLoader() {
  return (
    <View
      className="flex-1 items-center justify-center gap-6"
      style={{ backgroundColor: palette.brand600 }}
    >
      <Text className="text-3xl font-bold text-white">StudyGo</Text>
      <ActivityIndicator color="#ffffff" />
    </View>
  );
}
