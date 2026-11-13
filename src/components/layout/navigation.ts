import {
  BookOpenText,
  ChartNoAxesCombined,
  Compass,
  Heart,
  House,
  Layers,
  RotateCcw,
  Settings2,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceRoute = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navigationGroups: {
  label: string;
  routes: WorkspaceRoute[];
}[] = [
  {
    label: "Öğrenme alanın",
    routes: [
      { href: "/", label: "Genel bakış", icon: House },
      { href: "/learn", label: "Öğren", icon: BookOpenText },
      { href: "/review", label: "Tekrar et", icon: RotateCcw },
      { href: "/practice", label: "Pratik yap", icon: Layers },
    ],
  },
  {
    label: "Kişisel kütüphanen",
    routes: [
      { href: "/explorer", label: "Kelimeleri keşfet", icon: Compass },
      { href: "/favorites", label: "Favoriler", icon: Heart },
      { href: "/statistics", label: "İstatistikler", icon: ChartNoAxesCombined },
      { href: "/settings", label: "Ayarlar", icon: Settings2 },
    ],
  },
];

export function isRouteActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function getWorkspaceRoute(pathname: string) {
  return navigationGroups
    .flatMap((group) => group.routes)
    .find((route) => isRouteActive(pathname, route.href));
}
