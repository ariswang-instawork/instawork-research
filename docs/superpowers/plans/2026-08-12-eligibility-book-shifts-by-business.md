# Book Eligible Shifts From The Eligibility Drawer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in Instawork user expand an eligible site in the eligibility drawer to see that business's open shifts and book one directly.

**Architecture:** A new auth-required endpoint `GET /api/eligibility/sessions?business=<id>` returns a single business's servable shifts (reusing the existing servable rule via a new `getServableRowsForBusiness` helper). The `EligibilityCheckDrawer` Overview tab makes eligible cards expandable, lazily fetching those shifts through a new `useEligibilitySessions` hook and rendering minimal date · time rows with a Book button that opens the shift's Instawork deep link.

**Tech Stack:** Express 5 + TypeScript (`tsx`), Prisma → PostgreSQL, React 18 + TanStack React Query, wouter, Vitest.

## Global Constraints

- Backend runs with `tsx` (no type-check at runtime). `npm run check` has a known pre-existing `req.headers` typing error in `server/routes.ts` — do not "fix" it; only ensure no NEW type errors.
- The servable rule lives in ONE place (`getServableRows` in `server/serving.ts`): upcoming (`shiftDate >= today`), `openShiftsCount > 0`, `isOverbookShiftGroup === false`, valid https `shiftLink`. Reuse it; never re-implement it.
- Session shapes sent to the client use `toPublicSessionItem` (address/coords nulled).
- Auth gate matches `/api/eligibility`: no `req.session.accessToken` → `401`.
- Analytics go through `trackEvent` from `client/src/lib/analytics.ts`.
- Frontend eligibility hooks live in `client/src/hooks/use-auth.ts`.
- `bookUrl` is opened with `window.open(url, "_blank", "noopener,noreferrer")`.

---

### Task 1: Server helper `getServableRowsForBusiness` (TDD)

**Files:**
- Modify: `server/serving.ts` (add export after `getServableRows`, ~line 50)
- Test: `server/serving.test.ts` (create)

**Interfaces:**
- Consumes: `getServableRows(): Promise<ShiftGroup[]>` (existing).
- Produces: `getServableRowsForBusiness(businessId: number): Promise<ShiftGroup[]>` — the servable rows whose `businessId === businessId`, preserving `getServableRows` ordering.

- [ ] **Step 1: Write the failing test**

The helper filters whatever `getServableRows` returns by `businessId`. Mock `./db` so no real Postgres is needed, mirroring how the pure helpers are tested. Because `getServableRowsForBusiness` calls `getServableRows`, which calls `prisma.shiftGroup.findMany` and then filters by https link, seed the mock with rows that already satisfy the servable rule and vary only `businessId`.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("./db", () => ({ prisma: { shiftGroup: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import { getServableRowsForBusiness } from "./serving";

const base = {
  isOverbookShiftGroup: false,
  openShiftsCount: 2,
  shiftDate: "2999-01-01",
  shiftLink: "https://instawork.com/s/1",
};

beforeEach(() => findMany.mockReset());

describe("getServableRowsForBusiness", () => {
  it("returns only rows matching the businessId", async () => {
    findMany.mockResolvedValue([
      { ...base, id: 1, businessId: 100 },
      { ...base, id: 2, businessId: 200 },
      { ...base, id: 3, businessId: 100 },
    ]);
    const rows = await getServableRowsForBusiness(100);
    expect(rows.map((r) => r.id)).toEqual([1, 3]);
  });

  it("excludes non-servable rows (bad link) even when the businessId matches", async () => {
    findMany.mockResolvedValue([
      { ...base, id: 1, businessId: 100 },
      { ...base, id: 2, businessId: 100, shiftLink: "http://insecure" },
    ]);
    const rows = await getServableRowsForBusiness(100);
    expect(rows.map((r) => r.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- serving`
Expected: FAIL — `getServableRowsForBusiness is not a function` (not yet exported).

- [ ] **Step 3: Write minimal implementation**

Add to `server/serving.ts` immediately after `getServableRows`:

```ts
/** Servable rows for a single business (site), same ordering as getServableRows. */
export async function getServableRowsForBusiness(businessId: number): Promise<ShiftGroup[]> {
  const rows = await getServableRows();
  return rows.filter((r) => r.businessId === businessId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- serving`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/serving.ts server/serving.test.ts
git commit -m "feat(server): add getServableRowsForBusiness helper"
```

---

### Task 2: Endpoint `GET /api/eligibility/sessions`

**Files:**
- Modify: `server/routes.ts` (add route after the `/api/eligibility` handler, ~line 321; add import from `./serving`)

**Interfaces:**
- Consumes: `getServableRowsForBusiness(businessId)` (Task 1); `toPublicSessionItem` (existing in `server/serving.ts`).
- Produces: `GET /api/eligibility/sessions?business=<id>` → `200 { businessId: number, sessions: SessionItem[] }`; `400` invalid param; `401` unauthenticated; `500 { reason: "sessions_unavailable" }` on DB error.

- [ ] **Step 1: Update the serving import in `server/routes.ts`**

The current import (lines ~10) is:

```ts
import { getServableRows, sanitizeLabel } from "./serving";
```

Replace it with:

```ts
import { getServableRows, sanitizeLabel, getServableRowsForBusiness, toPublicSessionItem } from "./serving";
```

- [ ] **Step 2: Add the route handler**

Insert immediately after the closing `});` of the `app.get("/api/eligibility", ...)` handler (before `return httpServer;`):

```ts
  // Auth-required: open shifts for a single business (site) the worker is
  // eligible for. Same "servable" rule and address-hiding as public browsing.
  app.get("/api/eligibility/sessions", async (req, res) => {
    if (!req.session.accessToken) {
      return res.status(401).json({ error: "Not authenticated", reason: "unauthenticated" });
    }
    const raw = typeof req.query.business === "string" ? req.query.business.trim() : "";
    const businessId = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isInteger(businessId) || businessId <= 0) {
      return res.status(400).json({ error: "Missing or invalid 'business' parameter" });
    }
    try {
      const rows = await getServableRowsForBusiness(businessId);
      res.json({ businessId, sessions: rows.map(toPublicSessionItem) });
    } catch (error) {
      console.error("eligibility sessions lookup failed:", error);
      res.status(500).json({
        error: "We couldn't load shifts right now — please try again",
        reason: "sessions_unavailable",
      });
    }
  });
```

- [ ] **Step 3: Manually verify the auth gate and validation**

Run (server started separately with `npm run dev`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5000/api/eligibility/sessions?business=201172"   # expect 401 (no session cookie)
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5000/api/eligibility/sessions"                     # expect 401 (auth checked first)
```

Expected: `401` for both (auth is checked before param validation, so an unauthenticated call never reveals validation behavior — that is fine).

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "feat(server): add GET /api/eligibility/sessions endpoint"
```

---

### Task 3: Client hook `useEligibilitySessions`

**Files:**
- Modify: `client/src/hooks/use-auth.ts` (add after `useEligibility`, ~line 55; import `SessionItem` type)

**Interfaces:**
- Consumes: endpoint from Task 2; `SessionItem` from `@/lib/api-client/generated/api.schemas`.
- Produces: `useEligibilitySessions(businessId: number | null, enabled: boolean)` → React Query result of `{ businessId: number; sessions: SessionItem[] }`.

- [ ] **Step 1: Add the type import at the top of `client/src/hooks/use-auth.ts`**

After the existing first import line (`import { useQuery, useQueryClient } from "@tanstack/react-query";`), add:

```ts
import type { SessionItem } from "@/lib/api-client/generated/api.schemas";
```

- [ ] **Step 2: Add the hook**

Insert after the `useEligibility` function (before `export function login()`):

```ts
export type EligibilitySessionsResponse = {
  businessId: number;
  sessions: SessionItem[];
};

/** Open shifts for one eligible business/site. Lazy — only runs when enabled. */
export function useEligibilitySessions(businessId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ["eligibility-sessions", businessId],
    enabled: enabled && businessId != null,
    retry: false,
    queryFn: async (): Promise<EligibilitySessionsResponse> => {
      const resp = await fetch(`${base}api/eligibility/sessions?business=${businessId}`, {
        credentials: "include",
      });
      if (!resp.ok) throw new Error(String(resp.status));
      return resp.json();
    },
  });
}
```

- [ ] **Step 3: Type-check for new errors**

Run: `npm run check 2>&1 | grep -v "req.headers" | grep "use-auth" || echo "no new use-auth errors"`
Expected: `no new use-auth errors`.

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/use-auth.ts
git commit -m "feat(client): add useEligibilitySessions hook"
```

---

### Task 4: Expand-in-place UI + Book + analytics

**Files:**
- Modify: `client/src/components/Drawers.tsx` (imports; `EligibilityCheckDrawer` Overview tab, ~lines 3-6 and 472-500)

**Interfaces:**
- Consumes: `useEligibilitySessions` (Task 3); `trackEvent` (existing); `EligibilitySite` type already used in the drawer.
- Produces: an `ExpandableEligibilitySiteCard` sub-component rendered in the Overview tab.

- [ ] **Step 1: Update imports at the top of `client/src/components/Drawers.tsx`**

Change the hooks import (line ~3) from:

```ts
import { useAuthStatus, useEligibility, login } from "@/hooks/use-auth";
```

to:

```ts
import { useAuthStatus, useEligibility, useEligibilitySessions, login, type EligibilitySite } from "@/hooks/use-auth";
```

Add `ChevronDown` to the lucide import (line ~6):

```ts
import { MapPin, Navigation, ShieldCheck, X, Check, Info, ChevronDown } from "lucide-react";
```

Add the analytics import after the existing imports (near line 19, after the drawer imports):

```ts
import { trackEvent } from "@/lib/analytics";
```

- [ ] **Step 2: Add the `ExpandableEligibilitySiteCard` component**

Insert above the `EligibilityCheckDrawer` export (before `export function EligibilityCheckDrawer`):

```tsx
/**
 * Overview-tab card for an eligible site (not blocked, remaining > 0). Expands
 * in place to lazily load that business's open shifts; each shift books via its
 * Instawork deep link. Blocked / maxed-out sites never use this component.
 */
function ExpandableEligibilitySiteCard({
  site,
  isOpen,
  onToggle,
}: {
  site: EligibilitySite;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { data, isLoading, isError } = useEligibilitySessions(site.businessId, isOpen);
  const sessions = data?.sessions ?? [];

  return (
    <div className="rounded-[12px] border bg-white border-[hsl(var(--border))] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-start justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-gray-900">
            {site.siteLabel ?? "Session site"}
          </span>
          <span className="block text-sm text-muted-foreground mt-0.5">
            {site.remaining} of {site.cap} session{site.cap === 1 ? "" : "s"} remaining
          </span>
          {site.oneVisitLimit && (
            <span className="block text-sm text-blue-900/80 mt-2 leading-relaxed">
              New York: one visit limit. Additional visits are by invitation only.
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-[hsl(var(--border))]">
          {isLoading ? (
            <div className="space-y-2 pt-2">
              <div className="h-10 rounded-lg bg-muted animate-pulse" />
              <div className="h-10 rounded-lg bg-muted animate-pulse" />
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground pt-3">Couldn't load shifts right now.</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground pt-3">No open shifts right now.</p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[14px] text-gray-900 min-w-0 truncate">
                    {s.date} · {s.time}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent("eligibility_shift_book_clicked", {
                        business_id: site.businessId,
                        session_id: s.id,
                      });
                      if (s.bookUrl) window.open(s.bookUrl, "_blank", "noopener,noreferrer");
                    }}
                    className="shrink-0 text-[14px] font-semibold text-white bg-cta-gradient rounded-[8px] px-4 py-2 hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    Book
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Track the expanded business in `EligibilityCheckDrawer`**

Immediately after the existing `const [tab, setTab] = useState<"overview" | "sessions">("overview");` line (~line 394), add:

```tsx
  const [expandedBusiness, setExpandedBusiness] = useState<number | null>(null);
```

- [ ] **Step 4: Render eligible cards via the new component in the Overview branch**

In the Overview branch (`tab === "overview" ? eligibility.data?.sites.map((s) => ( ... ))`), replace the mapped card JSX so blocked / remaining-0 sites keep the current static card and eligible sites use the expandable one. Replace the block starting `? eligibility.data?.sites.map((s) => (` and ending at its matching `))` (the Overview branch only — lines ~473-500) with:

```tsx
                  ? eligibility.data?.sites.map((s) =>
                      s.isBlocked || s.remaining <= 0 ? (
                        <div
                          key={s.businessId}
                          className={`p-4 rounded-[12px] border ${
                            s.isBlocked
                              ? "bg-amber-50 border-amber-200"
                              : "bg-white border-[hsl(var(--border))]"
                          }`}
                        >
                          <p className="text-[15px] font-bold text-gray-900">
                            {s.siteLabel ?? "Session site"}
                          </p>
                          {s.isBlocked ? (
                            <p className="text-sm font-medium text-amber-900 mt-0.5">
                              You can't book more sessions at this site.
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {s.remaining} of {s.cap} session{s.cap === 1 ? "" : "s"} remaining
                            </p>
                          )}
                          {s.oneVisitLimit && (
                            <p className="text-sm text-blue-900/80 mt-2 leading-relaxed">
                              New York: one visit limit. Additional visits are by invitation only.
                            </p>
                          )}
                        </div>
                      ) : (
                        <ExpandableEligibilitySiteCard
                          key={s.businessId}
                          site={s}
                          isOpen={expandedBusiness === s.businessId}
                          onToggle={() => {
                            setExpandedBusiness((cur) => {
                              const next = cur === s.businessId ? null : s.businessId;
                              if (next !== null)
                                trackEvent("eligibility_site_expanded", { business_id: s.businessId });
                              return next;
                            });
                          }}
                        />
                      ),
                    )
```

- [ ] **Step 5: Type-check for new errors**

Run: `npm run check 2>&1 | grep -v "req.headers" | grep "Drawers" || echo "no new Drawers errors"`
Expected: `no new Drawers errors`.

- [ ] **Step 6: Manual smoke (build succeeds)**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/Drawers.tsx
git commit -m "feat(client): expand eligible sites to book shifts in the drawer"
```

---

## Self-Review

**1. Spec coverage:**
- Endpoint `/api/eligibility/sessions` (auth, validation, servable filter, public serializer) → Task 2. ✅
- `getServableRowsForBusiness` helper + unit test → Task 1. ✅
- Expand-only-when eligible (`!isBlocked && remaining > 0`); blocked/maxed unchanged → Task 4 Step 4. ✅
- Lazy fetch on expand via `useEligibilitySessions` → Tasks 3, 4. ✅
- Loading / empty ("No open shifts right now") / error states → Task 4 Step 2. ✅
- Minimal row (date · time + Book) → Task 4 Step 2. ✅
- Book opens `bookUrl` in a new tab → Task 4 Step 2. ✅
- Analytics `eligibility_site_expanded`, `eligibility_shift_book_clicked` → Task 4 Steps 2, 4. ✅
- "My sessions" tab unchanged → not modified in any task. ✅

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. ✅

**3. Type consistency:** `getServableRowsForBusiness(businessId: number)` defined in Task 1 and consumed identically in Task 2. `useEligibilitySessions(businessId, enabled)` defined in Task 3, consumed in Task 4. `EligibilitySite` fields (`businessId`, `siteLabel`, `cap`, `remaining`, `isBlocked`, `oneVisitLimit`) match `client/src/hooks/use-auth.ts`. `SessionItem` fields (`id`, `date`, `time`, `bookUrl`) match `api.schemas.ts`. ✅
