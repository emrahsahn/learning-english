import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "lexi-access";
const TTL_SECONDS = 60 * 60 * 24 * 7;
export { TTL_SECONDS };
export function configuredPassword() { return process.env.SITE_PASSWORD; }
export function matchesPassword(input: string): boolean {
  const secret = configuredPassword();
  if (!secret) return false;
  const hash = (s: string) => createHmac("sha256", "lexi-password-check").update(s).digest();
  return timingSafeEqual(hash(input), hash(secret));
}
export function signAccess(expires: number): string {
  const secret = configuredPassword();
  if (!secret) throw new Error("SITE_PASSWORD eksik");
  const payload = `v1.${expires}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}
export function validAccess(token?: string): boolean {
  if (!token || !configuredPassword()) return false;
  const match = /^v1\.(\d{13})\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[1]) < Date.now() || Number(match[1]) > Date.now() + TTL_SECONDS * 1000 + 60000) return false;
  const expected = signAccess(Number(match[1]));
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
