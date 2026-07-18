import {
  ArrowLeftRight,
  ChartLine,
  LayoutDashboard,
  Package,
  Settings,
  Sheet,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Pressed after `g` to jump to the page (SPEC §10). */
  shortcut?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard, shortcut: "d" },
  { title: "Datasets", href: "/datasets", icon: Sheet, shortcut: "e" },
  { title: "Import", href: "/import", icon: Upload, shortcut: "i" },
  { title: "Products", href: "/products", icon: Package, shortcut: "p" },
  { title: "Transactions", href: "/transactions", icon: ArrowLeftRight, shortcut: "t" },
  { title: "Parties", href: "/parties", icon: Users, shortcut: "y" },
  { title: "Analytics", href: "/analytics", icon: ChartLine, shortcut: "a" },
  { title: "Settings", href: "/settings", icon: Settings, shortcut: "s" },
];
