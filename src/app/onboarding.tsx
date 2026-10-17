import { OnboardingSlideView } from "@/components/onboarding-slide";
import { Button } from "@/components/ui/button";
import { ONBOARDING_SLIDES } from "@/constants/onboarding";
import { useOnboarding } from "@/features/onboarding/onboarding-provider";
import { cn } from "@/lib/cn";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, Text, View, useWindowDimensions, type ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const VIEWABILITY_CONFIG = { viewAreaCoveragePercentThreshold: 50 };

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useOnboarding();

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) {
      setIndex(first.index);
    }
  }, []);

  const isLast = index === ONBOARDING_SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      completeOnboarding();
    } else {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const handleGoToIndex = (i: number) => {
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      <View
        className="flex-row items-center justify-between px-6"
        style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}
      >
        <Text className="text-lg font-bold text-slate-900 dark:text-white">StudyGo</Text>
        <Pressable onPress={handleSkip} hitSlop={8}>
          <Text className="text-sm font-medium text-brand-600 dark:text-brand-400">تخطي</Text>
        </Pressable>
      </View>
      <FlatList
        ref={listRef}
        data={ONBOARDING_SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        // Pin the pager to LTR: in an RTL layout (Arabic) React Native mirrors
        // horizontal FlatLists, which made the last slide land first and broke
        // the pagingEnabled / getItemLayout / scrollToIndex offset math. Slide
        // content restores its own RTL direction in OnboardingSlideView.
        style={{ direction: "ltr" }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        renderItem={({ item }) => <OnboardingSlideView slide={item} />}
        contentContainerStyle={{ alignItems: "stretch" }}
      />
      <View
        className="px-6"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View className="flex-row items-center justify-center gap-2 pb-6" style={{ direction: "ltr" }}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <Pressable key={i} onPress={() => handleGoToIndex(i)} hitSlop={6} className="px-1 py-1">
              <View
                className={cn(
                  "h-2 rounded-full transition",
                  index === i
                    ? "w-6 bg-brand-600 dark:bg-brand-500"
                    : "w-2 bg-slate-300 dark:bg-slate-600"
                )}
              />
            </Pressable>
          ))}
        </View>
        <Button
          label={isLast ? "ابدأ الآن" : "التالي"}
          onPress={handleNext}
        />
      </View>
    </View>
  );
}
