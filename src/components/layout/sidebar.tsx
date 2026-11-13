"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BookOpenText, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { isRouteActive, navigationGroups } from "@/components/layout/navigation";

type SidebarProps = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <Link
        href="/"
        onClick={onNavigate}
        aria-label="Lexi — Oxford 3000, ana sayfa"
        className="mx-6 mt-9 mb-10 flex w-fit items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-4 focus-visible:ring-offset-sidebar"
      >
        <span className="flex size-10 items-center justify-center rounded-[14px] bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_4px_12px_-4px_var(--sidebar-primary)]">
          <BookOpenText className="size-5" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span>
          <span className="block text-[30px] leading-none font-semibold tracking-[-0.07em]">
            lexi<span className="text-primary">.</span>
          </span>
          <span className="mt-1.5 block text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Oxford 3000
          </span>
        </span>
      </Link>

      <nav aria-label="Ana gezinme" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {navigationGroups.map((group) => (
          <div key={group.label} className="mb-7 last:mb-0">
            <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.routes.map(({ href, label, icon: Icon }) => {
                const active = isRouteActive(pathname, href);

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        active
                          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                          : "font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2 : 1.7} aria-hidden="true" />
                      <span>{label}</span>
                      {active && (
                        <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-5 mb-6 shrink-0 rounded-[20px] border border-sidebar-border bg-background/70 p-4">
        <Sprout className="mb-3 size-5 text-primary" strokeWidth={1.6} aria-hidden="true" />
        <p className="text-sm font-medium tracking-tight">Az ama her gün.</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Küçük adımlar, kalıcı kelimeler.
        </p>
        <Link
          href="/learn"
          onClick={onNavigate}
          className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Öğrenmeye başla
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
