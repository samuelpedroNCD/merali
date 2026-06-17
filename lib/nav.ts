import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  ScrollText,
  ReceiptText,
  Wrench,
  ChartLine,
  BookOpenText,
  KeyRound,
  ListChecks,
  Truck,
  IdCard,
  BadgeCheck,
  BellRing,
  History,
  FileBarChart,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Module key used by the permission system. */
  module: string;
};

export type NavSection = { label: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
      { label: "Properties", href: "/properties", icon: Building2, module: "properties" },
      { label: "Tenants", href: "/tenants", icon: Users, module: "tenants" },
      { label: "Landlords", href: "/landlords", icon: Briefcase, module: "landlords" },
      { label: "Tenancies", href: "/tenancies", icon: ScrollText, module: "leases" },
      { label: "Payments", href: "/payments", icon: ReceiptText, module: "finance" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Maintenance", href: "/maintenance", icon: Wrench, module: "maintenance" },
      { label: "Finances", href: "/finances", icon: ChartLine, module: "finance" },
      { label: "Nominal", href: "/nominal", icon: BookOpenText, module: "finance" },
      { label: "Unreconciled", href: "/unreconciled", icon: ListChecks, module: "finance" },
      { label: "Keys", href: "/keys", icon: KeyRound, module: "keys" },
      { label: "Suppliers", href: "/suppliers", icon: Truck, module: "suppliers" },
      { label: "Staff/Team", href: "/staff", icon: IdCard, module: "staff" },
    ],
  },
  {
    label: "Compliance & Docs",
    items: [
      { label: "Certifications", href: "/certifications", icon: BadgeCheck, module: "certifications" },
      { label: "Reminders", href: "/reminders", icon: BellRing, module: "reminders" },
      { label: "Reports", href: "/reports", icon: FileBarChart, module: "reports" },
      { label: "Logs", href: "/logs", icon: History, module: "logs" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Roles", href: "/roles", icon: ShieldCheck, module: "roles" },
      { label: "Settings", href: "/settings", icon: Settings, module: "settings" },
    ],
  },
];
