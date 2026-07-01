import {
  LayoutDashboard,
  Activity,
  Layers,
  Target,
  CheckSquare,
  Sun,
  Moon,
  Map,
  MessageSquare,
  Zap,
  BookOpen,
  Brain,
  Bot,
  Sparkles,
  Compass,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  key:
    | "nav.commandCenter"
    | "nav.clarity"
    | "nav.innerOs"
    | "nav.agentActions"
    | "nav.lifeMap"
    | "nav.domains"
    | "nav.alignment"
    | "nav.missions"
    | "nav.tasks"
    | "nav.briefing"
    | "nav.debrief"
    | "nav.chat"
    | "nav.execute"
    | "nav.journal"
    | "nav.vision";
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/", key: "nav.commandCenter", icon: LayoutDashboard },
  { href: "/clarity", key: "nav.clarity", icon: Sparkles },
  { href: "/inner-os", key: "nav.innerOs", icon: Brain },
  { href: "/agent-actions", key: "nav.agentActions", icon: Bot },
  { href: "/life-map", key: "nav.lifeMap", icon: Map },
  { href: "/domains", key: "nav.domains", icon: Layers },
  { href: "/alignment", key: "nav.alignment", icon: Activity },
  { href: "/missions", key: "nav.missions", icon: Target },
  { href: "/tasks", key: "nav.tasks", icon: CheckSquare },
  { href: "/briefing", key: "nav.briefing", icon: Sun },
  { href: "/debrief", key: "nav.debrief", icon: Moon },
  { href: "/chat", key: "nav.chat", icon: MessageSquare },
  { href: "/execute", key: "nav.execute", icon: Zap },
  { href: "/journal", key: "nav.journal", icon: BookOpen },
  { href: "/vision", key: "nav.vision", icon: Compass },
];

/** Primary tabs on mobile bottom bar */
export const mobileTabItems: NavItem[] = [
  navItems[0],
  navItems[1],
  navItems[2],
  navItems[6],
];
