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

export const TABS: TabConfig[] = [
  { name: "index", label: "الرئيسية", icon: House },
  { name: "courses", label: "المقررات", icon: BookOpen },
  { name: "account", label: "الحساب", icon: UserRound },
];
