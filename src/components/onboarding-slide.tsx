import { Image } from "expo-image";
import { Text, View, useWindowDimensions } from "react-native";
import type { OnboardingSlide } from "@/constants/onboarding";

type Props = {
  slide: OnboardingSlide;
};

export function OnboardingSlideView({ slide }: Props) {
  const { width } = useWindowDimensions();

  return (
    <View style={{ width }} className="flex-1 px-8">
      <View className="flex-1 items-center justify-center">
        <Image
          source={slide.image}
          contentFit="contain"
          style={{ width: "100%", maxWidth: 280, height: 240 }}
          transition={200}
        />
      </View>
      <View className="items-end gap-2 pb-10 pt-6">
        <Text className="text-right text-3xl font-bold leading-9 text-slate-900 dark:text-white">
          {slide.title}
        </Text>
        <Text className="text-right text-base leading-6 text-slate-500 dark:text-slate-400">
          {slide.description}
        </Text>
      </View>
    </View>
  );
}
