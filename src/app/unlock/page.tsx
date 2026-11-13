"use client";
import { useState } from "react";
import { BookOpen, ArrowRight, LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function UnlockPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(new URL("/", window.location.origin).href);
    } catch (e) { setError(e instanceof Error ? e.message : "Bağlantı kurulamadı."); setBusy(false); }
  }
  return <main className="min-h-screen grid place-items-center bg-background p-6"><div className="w-full max-w-md">
    <div className="mb-10 flex items-center gap-3"><div className="rounded-2xl bg-primary p-3 text-primary-foreground"><BookOpen className="size-6" /></div><span className="text-3xl font-semibold tracking-tight">lexi<span className="text-primary">.</span></span></div>
    <div className="rounded-3xl border bg-card p-8 shadow-sm"><LockKeyhole className="size-7 text-primary mb-5" /><h1 className="text-2xl font-semibold tracking-tight">Kendi öğrenme alanın.</h1><p className="mt-3 mb-7 text-muted-foreground leading-relaxed">Oxford 3000 yolculuğuna devam etmek için site şifreni gir. Hesap veya üyelik gerekmiyor.</p>
      <form onSubmit={submit} className="space-y-4"><Label htmlFor="password">Site şifresi</Label><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="h-12" />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} className="w-full h-12">{busy ? <Loader2 className="animate-spin" /> : <>Öğrenme alanını aç <ArrowRight /></>}</Button></form>
    </div><p className="mt-6 text-center text-xs text-muted-foreground">İlerlemen bu cihazın tarayıcısında saklanır. Düzenli yedek almayı unutma.</p>
  </div></main>;
}
