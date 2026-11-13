import type { LucideIcon } from "lucide-react";
import { ExternalLink, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export type RunOperation = <T>(label: string, action: () => Promise<T>) => Promise<T>;

export function errorMessage(error: unknown): string {
  if (error instanceof SyntaxError) return "Dosya geçerli JSON değil. Dosyanın içeriğini kontrol edip yeniden seç.";
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) {
    return error.issues.slice(0, 4).map((issue: { path?: PropertyKey[]; message?: string }) => `${issue.path?.map(String).join(" → ") || "Dosya"}: ${issue.message ?? "Geçersiz değer"}`).join(" · ");
  }
  return error instanceof Error ? error.message : "İşlem tamamlanamadı. Verilerin kaydedildiği doğrulanamadı.";
}

export function SectionHeading({ id, icon: Icon, eyebrow, title, description }: { id: string; icon: LucideIcon; eyebrow: string; title: string; description: string }) {
  return <div className="mb-6 flex items-start gap-4">
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><Icon className="size-5" strokeWidth={1.7} aria-hidden="true" /></div>
    <div className="min-w-0"><p className="eyebrow">{eyebrow}</p><h2 id={id} className="mt-1.5 text-lg font-medium tracking-tight">{title}</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p></div>
  </div>;
}

export function InlineError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{message}</span></p>;
}

export function SourceLink({ href, children, download }: { href: string; children: ReactNode; download?: boolean }) {
  return <a href={href} target={download ? undefined : "_blank"} rel={download ? undefined : "noopener noreferrer"} download={download || undefined} className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-xs font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-ring"><span className="min-w-0 break-words">{children}</span>{!download && <ExternalLink className="size-3 shrink-0" aria-hidden="true" />}{!download && <span className="sr-only"> (yeni sekmede açılır)</span>}</a>;
}

export function RecordCounts({ vocabulary, progress, reviews, quizzes }: { vocabulary: number; progress: number; reviews: number; quizzes: number }) {
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
    ["Kelime", vocabulary], ["İlerleme", progress], ["Tekrar kaydı", reviews], ["Test", quizzes],
  ].map(([label, value]) => <div key={label} className="rounded-xl border bg-background/60 px-3 py-3"><dt className="text-[10px] text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-medium tabular-nums">{Number(value).toLocaleString("tr-TR")}</dd></div>)}</dl>;
}
