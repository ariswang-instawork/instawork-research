# "My Sessions" Returning-User Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the returning-user journey with a compact two-choice band on the landing hero and a dedicated, deep-linkable `/my-sessions` page, making it the single eligibility surface (retiring the bottom-sheet drawer).

**Architecture:** Extract the eligibility content out of `EligibilityCheckDrawer` into a container-free `EligibilityPanel`, render it full-page at a new `/my-sessions` route, repoint every entry point (hero card, mobile menu, new desktop header link) at the page, then delete the drawer. Data flow (auth/eligibility hooks + endpoints) is unchanged.

**Tech Stack:** React 18 + TypeScript, wouter routing, TanStack React Query, Tailwind v4, Vite.

## Global Constraints

- Do NOT change any API endpoint or the `useAuthStatus` / `useEligibility` / `useEligibilitySessions` hooks — behavior is reused as-is.
- `npm run check` has a known pre-existing `req.headers` typing error in `server/routes.ts` (per AGENTS.md) — do not "fix" it; only ensure no NEW type errors.
- `LocationDrawer` in `client/src/components/Drawers.tsx` must remain and keep working.
- Analytics go through `trackEvent` from `@/lib/analytics`.
- `login()` (from `@/hooks/use-auth`) already stores the current path and returns the user there after OAuth — reuse it for the logged-out page state.
- Keep the existing landing hero content (stat cards, `LocationSelector`, "Book sessions near me") intact; the band is added ABOVE it.
- Task order is chosen so the app builds green after every task (the drawer is deleted last, after its importers are gone).

---

### Task 1: Create the container-free `EligibilityPanel`

**Files:**
- Create: `client/src/components/EligibilityPanel.tsx`

**Interfaces:**
- Consumes: `useAuthStatus`, `useEligibility`, `useEligibilitySessions`, `login`, `EligibilitySite` (from `@/hooks/use-auth`); `trackEvent`; `Button`.
- Produces: `export function EligibilityPanel()` — renders the eligibility experience with no drawer chrome (auth-loading skeleton, logged-out login prompt, or the logged-in Remaining/History tabs).

- [ ] **Step 1: Create the file with the full component**

This moves `SessionLimitPolicyNotice` and `ExpandableEligibilitySiteCard` out of the drawer (verbatim behavior) and renders the panel content directly. Tabs are renamed to `remaining` / `history` with labels "Remaining" / "History". `useEligibility` is enabled whenever authenticated (no drawer "isOpen" gate on a page).

```tsx
import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAuthStatus,
  useEligibility,
  useEligibilitySessions,
  login,
  type EligibilitySite,
} from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

function SessionLimitPolicyNotice() {
  return (
    <div className="p-4 rounded-[12px] border border-blue-200 bg-blue-50 text-sm text-blue-950">
      <div className="flex gap-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-700" aria-hidden="true" />
        <div className="space-y-1.5">
          <p className="font-semibold text-blue-950">How session limits work</p>
          <p className="text-blue-900/90 leading-relaxed">
            Most locations let you book up to 3 sessions per site.
          </p>
          <p className="text-blue-900/90 leading-relaxed">
            <span className="font-medium">New York is limited to 1 visit.</span> If you have already
            completed a New York session, our team may invite you back for additional visits.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Remaining-tab card for an eligible site (not blocked, remaining > 0). Expands
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

/**
 * The eligibility experience with no drawer chrome, for rendering full-page on
 * /my-sessions. Handles auth-loading, logged-out (login prompt), and logged-in
 * (Remaining / History tabs) states.
 */
export function EligibilityPanel() {
  const [tab, setTab] = useState<"remaining" | "history">("remaining");
  const [expandedBusiness, setExpandedBusiness] = useState<number | null>(null);

  const { data: auth, isLoading: authLoading } = useAuthStatus();
  const isAuthenticated = !!auth?.authenticated;
  const eligibility = useEligibility(isAuthenticated);

  if (authLoading) {
    return (
      <div className="space-y-3">
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-[12px] border border-[hsl(var(--border))] bg-white p-6 text-center">
        <p className="text-[17px] font-bold text-gray-900">Log in to see your sessions</p>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          Log in with your Instawork account to see how many sessions you can still book.
        </p>
        <Button
          className="w-full h-12 rounded-[8px] font-bold bg-cta-gradient hover:brightness-105 active:brightness-95 shadow-none mt-5"
          onClick={login}
        >
          Log in with Instawork
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-[hsl(var(--border))]">
        <button
          onClick={() => setTab("remaining")}
          className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "remaining"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Remaining
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          History
        </button>
      </div>

      <div className="space-y-3">
        {eligibility.isLoading ? (
          <div className="space-y-3">
            <div className="h-14 rounded-xl bg-muted animate-pulse" />
            <div className="h-14 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : eligibility.isError ? (
          <div className="p-4 rounded-[12px] text-sm font-medium border bg-destructive/10 text-destructive border-destructive/20">
            Could not check eligibility right now.
            <span className="block mt-1 font-normal opacity-70">
              {eligibility.error instanceof Error ? eligibility.error.message : "unknown"}
            </span>
          </div>
        ) : eligibility.data && eligibility.data.sites.length === 0 ? (
          <div className="p-4 rounded-[12px] text-sm font-medium border bg-muted text-muted-foreground border-transparent">
            No session locations available right now.
          </div>
        ) : (
          <>
            <SessionLimitPolicyNotice />
            {tab === "remaining"
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
                      onToggle={() =>
                        setExpandedBusiness((cur) => {
                          const next = cur === s.businessId ? null : s.businessId;
                          if (next !== null)
                            trackEvent("eligibility_site_expanded", { business_id: s.businessId });
                          return next;
                        })
                      }
                    />
                  ),
                )
              : eligibility.data?.sites.map((s) => (
                  <div
                    key={s.businessId}
                    className="p-4 rounded-[12px] border border-[hsl(var(--border))] bg-white"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-[15px] font-bold text-gray-900">
                          {s.siteLabel ?? "Session site"}
                        </p>
                        {s.oneVisitLimit && (
                          <p className="text-sm text-blue-900/80 mt-1 leading-relaxed">
                            New York: one visit limit. Additional visits are by invitation only.
                          </p>
                        )}
                      </div>
                      {s.isBlocked && (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                          Maxed out
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Booked</span>
                        <span className="font-medium">{s.bookedCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Completed</span>
                        <span className="font-medium">{s.completedCount}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-[hsl(var(--border))] pt-2 mt-2">
                        <span className="font-medium">Remaining</span>
                        <span className="font-bold text-primary">
                          {s.remaining}/{s.cap}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check for new errors**

Run: `npm run check 2>&1 | grep "EligibilityPanel" || echo "no EligibilityPanel errors"`
Expected: `no EligibilityPanel errors`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/EligibilityPanel.tsx
git commit -m "feat(client): extract EligibilityPanel from the eligibility drawer"
```

---

### Task 2: `/my-sessions` page + route

**Files:**
- Create: `client/src/pages/MySessions.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `EligibilityPanel` (Task 1); `trackEvent`; wouter `Link`.
- Produces: default-exported `MySessions` page; a `/my-sessions` route.

- [ ] **Step 1: Create `client/src/pages/MySessions.tsx`**

```tsx
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { EligibilityPanel } from "@/components/EligibilityPanel";
import { trackEvent } from "@/lib/analytics";

export default function MySessions() {
  useEffect(() => {
    trackEvent("my_sessions_page_viewed", {});
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-background">
      <main className="flex-1 overflow-y-auto px-5 md:px-6">
        <div className="max-w-md md:max-w-2xl mx-auto w-full pt-5 md:pt-10 pb-24 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Link href="/" className="inline-flex items-center mb-6 -ml-1" aria-label="Back to home">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#11243e]">
            Your sessions
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1.5 mb-6">
            Based on your Instawork account.
          </p>
          <EligibilityPanel />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Register the route in `client/src/App.tsx`**

Add the import after the other page imports (after the `GetApp` import line):

```tsx
import MySessions from "@/pages/MySessions";
```

Add the route inside `<Switch>`, immediately after the `<Route path="/sessions/:id" component={SessionDetail} />` line:

```tsx
        <Route path="/my-sessions" component={MySessions} />
```

- [ ] **Step 3: Type-check + build**

Run: `npm run check 2>&1 | grep -E "MySessions|App.tsx" || echo "no new errors"`
Expected: `no new errors`.
Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/MySessions.tsx client/src/App.tsx
git commit -m "feat(client): add deep-linkable /my-sessions page"
```

---

### Task 3: Landing hero two-choice band + remove old entry points

**Files:**
- Modify: `client/src/pages/Landing.tsx`

**Interfaces:**
- Consumes: existing `useLocation` (`setLocation`), `handleSeeSessions`, `utmProps`, `trackEvent`, `site`.
- Produces: the hero band; removes the old bottom text link, the `eligibilityOpen` state, and the `EligibilityCheckDrawer` usage/import.

- [ ] **Step 1: Remove the `EligibilityCheckDrawer` import**

Delete this line (~line 4):

```tsx
import { EligibilityCheckDrawer } from "@/components/Drawers";
```

- [ ] **Step 2: Remove the `eligibilityOpen` state**

Delete this line (~line 78):

```tsx
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
```

- [ ] **Step 3: Add path handlers**

Immediately after the existing `handleSeeSessions` function (which ends with the `scrollToSessions();` block), add:

```tsx
  const handleBrowsePath = () => {
    trackEvent("new_user_path_clicked", { selected_city: site?.label ?? null, ...utmProps() });
    handleSeeSessions();
  };

  const handleReturningPath = () => {
    trackEvent("returning_user_path_clicked", { selected_city: site?.label ?? null, ...utmProps() });
    setLocation("/my-sessions");
  };
```

- [ ] **Step 4: Insert the two-choice band in the hero**

The benefit badges block ends with this markup:

```tsx
                <span className="inline-flex items-center gap-2 rounded-full bg-[#E8E4D9] px-4 py-2 text-[14px] font-semibold text-[#7C6534]">
                  <Clock className="w-4 h-4" strokeWidth={2} />
                  3 hours
                </span>
              </div>
```

Immediately AFTER that closing `</div>` (and before `<div className="mt-6 text-left">` that wraps `LocationSelector`), insert:

```tsx
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-[12px] border border-[#EEE9DD] bg-white p-4 text-left">
                  <p className="text-[15px] font-bold text-[#11243e]">New to research sessions?</p>
                  <p className="text-[13px] text-[#576270] mt-0.5">Browse paid sessions near you.</p>
                  <button
                    type="button"
                    onClick={handleBrowsePath}
                    className="mt-3 inline-flex items-center justify-center h-11 w-full rounded-[8px] border border-[#3351E6] text-[#3351E6] font-semibold text-[15px] active:opacity-80"
                  >
                    Browse sessions
                  </button>
                </div>
                <div className="rounded-[12px] border border-[#3351E6]/30 bg-[#F5F7FF] p-4 text-left">
                  <p className="text-[15px] font-bold text-[#11243e]">Already booked or completed a session?</p>
                  <p className="text-[13px] text-[#576270] mt-0.5">See the sessions you can still book.</p>
                  <button
                    type="button"
                    onClick={handleReturningPath}
                    className="mt-3 inline-flex items-center justify-center h-11 w-full rounded-[8px] bg-cta-gradient text-white font-semibold text-[15px] hover:brightness-105 active:brightness-95"
                  >
                    See my sessions
                  </button>
                </div>
              </div>
```

- [ ] **Step 5: Remove the old bottom-of-sessions text link**

Delete this whole block (~lines 418-429):

```tsx
            {hasCity && (
              <p className="text-[14px] text-[#576270] mt-6">
                Already booked or completed a session?{" "}
                <button
                  type="button"
                  onClick={() => setEligibilityOpen(true)}
                  className="text-[#3351E6] underline underline-offset-2"
                >
                  Check remaining sessions
                </button>
              </p>
            )}
```

- [ ] **Step 6: Remove the drawer render at the bottom of the component**

Delete this block (~lines 480-484), leaving the surrounding `</div>` that closes the page:

```tsx
      <EligibilityCheckDrawer
        hideTrigger
        open={eligibilityOpen}
        onOpenChange={setEligibilityOpen}
      />
```

- [ ] **Step 7: Type-check + build**

Run: `npm run check 2>&1 | grep "Landing" || echo "no Landing errors"`
Expected: `no Landing errors`.
Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/Landing.tsx
git commit -m "feat(client): add returning-user path band to landing hero"
```

---

### Task 4: Header nav entry points (desktop + mobile) + remove drawer from Shell

**Files:**
- Modify: `client/src/components/layout/Shell.tsx`

**Interfaces:**
- Consumes: existing `go(path)` helper.
- Produces: a desktop "My sessions" nav button + mobile-menu navigation to `/my-sessions`; removes the `EligibilityCheckDrawer` import, `eligibilityOpen` state, and drawer render.

- [ ] **Step 1: Remove the `EligibilityCheckDrawer` import**

Delete this line (~line 3):

```tsx
import { EligibilityCheckDrawer } from "@/components/Drawers";
```

- [ ] **Step 2: Remove the `eligibilityOpen` state**

Delete this line (~line 26):

```tsx
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
```

- [ ] **Step 3: Add "My sessions" to the desktop nav**

The desktop nav currently starts with the auth button:

```tsx
            <nav className="hidden md:flex items-center gap-6" aria-label="Main">
              <button type="button" onClick={handleAuthClick} className={navLink}>
                {isAuthenticated ? "Log out" : "Log in"}
              </button>
```

Insert a "My sessions" button as the FIRST child of the `<nav>`, before the auth button:

```tsx
            <nav className="hidden md:flex items-center gap-6" aria-label="Main">
              <button type="button" onClick={() => go("/my-sessions")} className={navLink}>
                My sessions
              </button>
              <button type="button" onClick={handleAuthClick} className={navLink}>
                {isAuthenticated ? "Log out" : "Log in"}
              </button>
```

- [ ] **Step 4: Point the mobile-menu "My sessions" item at the page**

Change the mobile menu item action from opening the drawer:

```tsx
                    { label: "My sessions", action: () => { closeMenu(); setEligibilityOpen(true); } },
```

to navigating:

```tsx
                    { label: "My sessions", action: () => go("/my-sessions") },
```

- [ ] **Step 5: Remove the drawer render from Shell**

Delete this block (~lines 206-211):

```tsx
        {/* Eligibility drawer opened from "Log in" — trigger footer hidden */}
        <EligibilityCheckDrawer
          hideTrigger
          open={eligibilityOpen}
          onOpenChange={setEligibilityOpen}
        />
```

- [ ] **Step 6: Type-check + build**

Run: `npm run check 2>&1 | grep "Shell" || echo "no Shell errors"`
Expected: `no Shell errors`.
Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/layout/Shell.tsx
git commit -m "feat(client): route header entry points to /my-sessions"
```

---

### Task 5: Retire `EligibilityCheckDrawer` and prune imports

**Files:**
- Modify: `client/src/components/Drawers.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Drawers.tsx` exporting only `LocationDrawer`.

- [ ] **Step 1: Delete the drawer-only code**

Remove these three top-level declarations from `client/src/components/Drawers.tsx` (all appear AFTER `LocationDrawer`):
- `function SessionLimitPolicyNotice() { ... }` (now in `EligibilityPanel`)
- `function ExpandableEligibilitySiteCard({ ... }) { ... }` (now in `EligibilityPanel`)
- `export function EligibilityCheckDrawer({ ... }) { ... }` (retired)

After this, `LocationDrawer` is the only exported component in the file.

> Note: `SessionLimitPolicyNotice` is defined near the TOP of the file (above `LocationDrawer`), while `ExpandableEligibilitySiteCard` and `EligibilityCheckDrawer` are below it. Remove all three regardless of position.

- [ ] **Step 2: Prune now-unused imports**

`LocationDrawer` uses only: `useRef`, `useState`, `useGetSites`, `calculateDistance`, `useSiteStorage`/`SiteOrigin`, `MapPin`, `Navigation`, `ShieldCheck`, `X`, `Check`, `Button`, `Input`, `Label`, and the drawer primitives `Drawer`, `DrawerContent`, `DrawerDescription`, `DrawerHeader`, `DrawerTitle`, `DrawerClose`.

Update the imports at the top of the file so they read exactly:

```tsx
import { useRef, useState } from "react";
import { useGetSites } from "@/lib/api-client";
import { calculateDistance } from "@/lib/zipCentroids";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { MapPin, Navigation, ShieldCheck, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
```

(Removed: `useAuthStatus`, `useEligibility`, `useEligibilitySessions`, `login`, `EligibilitySite`, `trackEvent`, `Info`, `ChevronDown`, `PrimaryCtaButton`, and `DrawerFooter`.)

- [ ] **Step 3: Verify nothing still imports the drawer**

Run: `grep -rn "EligibilityCheckDrawer" client/src || echo "no references remain"`
Expected: `no references remain`.

- [ ] **Step 4: Type-check + build**

Run: `npm run check 2>&1 | grep -v "req.headers" | grep "error TS" || echo "no new type errors"`
Expected: `no new type errors`.
Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Drawers.tsx
git commit -m "refactor(client): retire EligibilityCheckDrawer in favor of /my-sessions"
```

---

## Self-Review

**1. Spec coverage:**
- Extract `EligibilityPanel` (auth-loading / logged-out / logged-in tabs, moved helpers, tab rename) → Task 1. ✅
- `/my-sessions` page + route + `my_sessions_page_viewed` → Task 2. ✅
- Hero two-choice band (Browse → `handleSeeSessions`; See my sessions → `/my-sessions`) + `new_user_path_clicked` / `returning_user_path_clicked` → Task 3. ✅
- Remove old bottom link + Landing drawer usage → Task 3 Steps 5-6. ✅
- Desktop "My sessions" nav + mobile menu navigation + remove Shell drawer → Task 4. ✅
- Retire `EligibilityCheckDrawer`, keep `LocationDrawer`, prune imports → Task 5. ✅
- Endpoints/hooks unchanged → no task modifies them. ✅
- Logged-out deep link uses `login()` return path → Task 1 logged-out branch. ✅

**2. Placeholder scan:** No TBD/TODO; every code step shows full code or an exact edit. ✅

**3. Type consistency:** `EligibilityPanel` (no props) defined in Task 1, consumed in Task 2. `go("/my-sessions")` matches the route path added in Task 2. `EligibilitySite` / `SessionItem` fields used in the moved cards match `@/hooks/use-auth`. Tab union `"remaining" | "history"` is self-consistent within Task 1. Removed imports in Task 5 exactly match the symbols the drawer-only code used (`Info`, `ChevronDown`, `trackEvent`, `PrimaryCtaButton`, `DrawerFooter`, and the auth hooks). ✅
