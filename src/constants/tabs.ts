import {
    BookOpen,
    House,
    UserRound,
    type LucideIcon,
} from "lucide-react-native";

export type TabConfig = {
  name: string;
  label: string;
  icon: LucideIcon;
};

/**
 * The three primary destinations of the app: Home, Courses and Settings.
 * Grades are reached through a subject, never through a top-level tab.
 */
export const TABS: TabConfig[] = [
  { name: "index", label: "الرئيسية", icon: House },
  { name: "courses", label: "المقررات", icon: BookOpen },
  { name: "account", label: "الإعدادات", icon: UserRound },
];
