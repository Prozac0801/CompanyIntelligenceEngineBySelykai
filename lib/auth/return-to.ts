export function sanitizeReturnTo(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/workspace",
): string {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;

  try {
    const base = new URL("https://selykai.local");
    const target = new URL(raw, base);
    if (target.origin !== base.origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
