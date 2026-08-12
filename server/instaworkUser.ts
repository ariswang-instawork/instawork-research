export type ResolvedInstaworkUser = {
  workerId: number;
  name: string | null;
};

/**
 * Resolve the worker identity from Instawork's `GET /api/users/me/` response.
 *
 * The production API returns a JSON:API envelope where the worker id lives at
 * `data.id` (a string) and the profile fields under `data.attributes`. Older
 * local/dev stubs returned a flat object with a top-level `id`/`worker_id`/`pk`,
 * so both shapes are accepted. Returns null when no usable numeric id is found.
 */
export function resolveInstaworkUser(
  userData: Record<string, unknown> | null | undefined,
): ResolvedInstaworkUser | null {
  if (!userData) return null;

  const data = userData.data as
    | { id?: string | number; attributes?: Record<string, unknown> }
    | undefined;
  const attrs = (data?.attributes ?? userData) as Record<string, unknown>;

  const rawId = data?.id ?? userData.id ?? userData.worker_id ?? userData.pk;
  const workerId = Number(rawId);
  if (!Number.isFinite(workerId)) return null;

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const join = (...parts: unknown[]) =>
    parts.map(str).filter(Boolean).join(" ") || null;

  const name =
    str(attrs.full_name) ??
    join(attrs.given_name, attrs.family_name) ??
    join(attrs.first_name ?? attrs.name, attrs.last_name);

  return { workerId, name };
}
