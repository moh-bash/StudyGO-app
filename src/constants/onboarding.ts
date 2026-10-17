import type { ImageSourcePropType } from "react-native";

export type OnboardingSlide = {
  id: string;
  title: string;
  description: string;
  image: ImageSourcePropType;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "learn",
    title: "تعلّم بالوتيرة التي تناسبك",
    description: "يساعدك StudyGo على تنظيم موادك الدراسية ومتابعة تقدمك بكل سهولة.",
    image: require("@/assets/images/Explaining.png"),
  },
  {
    id: "explore",
    title: "استكشف أفكارًا جديدة",
    description: "اكتشف محتوى منتقى بعناية وابنِ رحلة تعليمية مخصّصة لك.",
    image: require("@/assets/images/Idea.png"),
  },
  {
    id: "achieve",
    title: "حقّق أهدافك",
    description: "حافظ على الاستمرارية مع التذكيرات الذكية وشاهد تقدّمك مع الوقت.",
    image: require("@/assets/images/Happy.png"),
  },
];
