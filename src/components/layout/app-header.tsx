"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { CalendarDays, ChevronRight, Loader2, LockKeyhole, Menu, Moon, Sun, X } from "lucide-react";
import { toast } from "sonner";
import { getWorkspaceRoute } from "@/components/layout/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function subscribeToDate(onChange: () => void) {
  const interval = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(interval);
}

function getLocalDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getServerDate() {
  return "";
}

function HeaderDate() {
  const date = useSyncExternalStore(subscribeToDate, getLocalDate, getServerDate);

  return (
    <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
      <CalendarDays className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
      <time dateTime={date || undefined}>
        {date
          ? new Intl.DateTimeFormat("tr-TR", {
              day: "numeric",
              month: "long",
              weekday: "long",
            }).format(new Date(`${date}T12:00:00`))
          : "Bugün"}
      </time>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl text-muted-foreground"
          aria-label="Açık / koyu temayı değiştir"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Moon className="size-[18px] dark:hidden" strokeWidth={1.7} aria-hidden="true" />
          <Sun className="hidden size-[18px] dark:block" strokeWidth={1.7} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>Temayı değiştir</TooltipContent>
    </Tooltip>
  );
}

function LockWorkspace() {
  const [isLocking, setIsLocking] = useState(false);

  async function lock() {
    if (isLocking) return;
    setIsLocking(true);

    try {
      const response = await fetch("/api/lock", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Lock request failed");
      // Reload the document so no unlocked workspace remains in the router cache.
      window.location.assign(new URL("/unlock", window.location.origin).href);
    } catch {
      toast.error("Çalışma alanı kilitlenemedi. Lütfen tekrar dene.");
      setIsLocking(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={isLocking}
          aria-busy={isLocking}
          aria-label={isLocking ? "Çalışma alanı kilitleniyor" : "Çalışma alanını kilitle"}
          className="h-10 gap-2 rounded-xl px-3 text-muted-foreground"
          onClick={lock}
        >
          {isLocking ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LockKeyhole className="size-4" strokeWidth={1.7} aria-hidden="true" />
          )}
          <span className="hidden text-xs sm:inline">{isLocking ? "Kilitleniyor…" : "Kilitle"}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>Çalışma alanını kilitle</TooltipContent>
    </Tooltip>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const route = getWorkspaceRoute(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 w-full max-w-[1280px] items-center justify-between gap-3 px-5 sm:px-8 xl:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 rounded-xl lg:hidden" aria-label="Gezinme menüsünü aç">
                <Menu className="size-5" strokeWidth={1.7} aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" showCloseButton={false} className="w-[280px] max-w-[85vw] gap-0 bg-sidebar p-0">
              <SheetTitle className="sr-only">Lexi gezinme menüsü</SheetTitle>
              <SheetDescription className="sr-only">Öğrenme alanına ve kişisel kelime kütüphanene git.</SheetDescription>
              <SheetClose asChild>
                <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 size-10 rounded-xl" aria-label="Gezinme menüsünü kapat">
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </SheetClose>
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <nav aria-label="İçerik yolu" className="mb-1 hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
              <Link href="/" className="rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">Çalışma alanı</Link>
              <ChevronRight className="size-3" aria-hidden="true" />
              <span aria-current="page">{route?.label ?? "Lexi"}</span>
            </nav>
            <p className="truncate text-sm font-medium tracking-tight">{route?.label ?? "Çalışma alanı"}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <HeaderDate />
          <span className="mx-2 hidden h-5 w-px bg-border md:block" aria-hidden="true" />
          <ThemeToggle />
          <LockWorkspace />
        </div>
      </div>
    </header>
  );
}
