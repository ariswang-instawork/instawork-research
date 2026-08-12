export type ResolvedInstaworkUser = {
  workerId: number;
  name: string | null;
};

/** Instawork /api/users/me/ returns JSON:API; accept flat shapes for local dev. */
export function resolveInstaworkUser(
  userData: Record<string, unknown> | null,
): ResolvedInstaworkUser | null {
  if (!userData) return null;
  const data = userData.data as
    | { id?: string | number; attributes?: Record<string, unknown> }
    | undefined;
  const attrs = (data?.attributes ?? userData) as Record<string, unknown>;
  const rawId = data?.id ?? userData.id ?? userData.worker_id ?? userData.pk;
  const workerId = Number(rawId);
  if (!Number.isFinite(workerId)) return null;
  const name =
    (typeof attrs.full_name === "string" && attrs.full_name) ||
    [attrs.given_name, attrs.family_name].filter((part) => typeof part === "string" && part).join(" ") ||
    [attrs.first_name ?? attrs.name, attrs.last_name]
      .filter((part) => typeof part === "string" && part)
      .join(" ") ||
    null;
  return { workerId, name: name || null };
}
