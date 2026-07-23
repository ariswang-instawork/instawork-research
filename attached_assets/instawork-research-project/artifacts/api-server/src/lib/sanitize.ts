const BANNED_PATTERNS: RegExp[] = [
  /q\s*\.?\s*ai/gi, // Q.ai, QAI, Q AI
  /ux[\s-]?study/gi,
];

/**
 * Strip internal codenames / partner names from any string headed to the UI.
 * Never mutates the DB — apply at the API response layer only.
 */
export function sanitizeLabel(s: string | null | undefined): string {
  if (!s) return "";
  let out = s;
  for (const re of BANNED_PATTERNS) {
    out = out.replace(re, "");
  }
  // collapse double spaces, trim stray separators
  out = out.replace(/\s{2,}/g, " ");
  out = out.replace(/^[\s\-·,:]+|[\s\-·,:]+$/g, "");
  return out;
}
