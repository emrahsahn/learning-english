import type { ReactNode } from "react";
import { HardDrive } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg outline-none focus:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        İçeriğe geç
      </a>

      <aside aria-label="Çalışma alanı menüsü" className="fixed inset-y-0 left-0 z-40 hidden w-[240px] border-r border-sidebar-border lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-h-svh min-w-0 flex-col lg:pl-[240px]">
        <AppHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1280px] flex-1 px-5 py-7 outline-none sm:px-8 sm:py-9 xl:px-10"
        >
          {children}
        </main>
        <footer className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 px-5 pt-2 pb-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 xl:px-10">
          <p className="flex items-center gap-2">
            <HardDrive className="size-3.5 shrink-0" strokeWidth={1.6} aria-hidden="true" />
            İlerlemen bu tarayıcıda saklanır
          </p>
          <p className="tracking-wide">Lexi · Kendi hızında, her gün.</p>
        </footer>
      </div>
    </div>
  );
}
