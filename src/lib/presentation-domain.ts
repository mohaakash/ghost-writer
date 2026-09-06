/** Return the data URL format used by the legacy generated-image preview. */
export function generatedImageDataUrl(base64: string | null | undefined): string {
  if (!base64) return "";
  if (base64.startsWith("data:image/")) return base64;
  const mimeType = base64.startsWith("/9j/")
    ? "image/jpeg"
    : base64.startsWith("UklGR")
      ? "image/webp"
      : "image/png";
  return `data:${mimeType};base64,${base64}`;
}

export function formatTime(timestamp: number, now = Date.now(), locale?: string): string {
  const date = new Date(timestamp);
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function formatLength(text: string, locale?: string): string {
  return `${text.length.toLocaleString(locale)} ${text.length === 1 ? "character" : "characters"}`;
}

export function formatShortcutKey(key: string): string {
  return key === " " ? "Space" : key.toUpperCase();
}

export function historyGroupLabel(timestamp: number, now = Date.now(), locale?: string): string {
  const date = new Date(timestamp);
  const today = new Date(now);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((startToday.getTime() - startDate.getTime()) / 86400000);

  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/** Match the legacy translation fallback: selected language, then English, then key. */
export function translate(
  key: string,
  currentLang: string,
  translations: Record<string, Record<string, string>>,
): string {
  return translations[currentLang]?.[key] || translations.en?.[key] || key;
}
