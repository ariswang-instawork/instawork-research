import { useState } from "react";
import { Info, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import {
  useAuthStatus,
  useEligibility,
} from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

export function SessionLimitPolicyNotice() {
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
 * The eligibility experience with no drawer chrome, for rendering full-page on
 * /my-sessions when authenticated. Handles auth-loading and logged-in
 * (Remaining / History tabs) states.
 */
export function EligibilityPanel() {
  const [tab, setTab] = useState<"remaining" | "history">("remaining");

  const { data: auth, isLoading: authLoading } = useAuthStatus();
  const isAuthenticated = !!auth?.authenticated;
  const eligibility = useEligibility(isAuthenticated);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="space-y-3">
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
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
                    <Link
                      key={s.businessId}
                      href={`/my-sessions/${s.businessId}`}
                      onClick={() =>
                        trackEvent("eligibility_site_expanded", { business_id: s.businessId })
                      }
                      className="flex items-start justify-between gap-3 p-4 rounded-[12px] border bg-white border-[hsl(var(--border))] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold text-gray-900">
                          {s.siteLabel ?? "Session site"}
                        </span>
                        <span className="block text-sm text-muted-foreground mt-0.5">
                          {s.remaining} of {s.cap} session{s.cap === 1 ? "" : "s"} remaining
                        </span>
                        {s.oneVisitLimit && (
                          <span className="block text-sm text-blue-900/80 mt-2 leading-relaxed">
                            New York: one visit limit. Additional visits are by invitation only.
                          </span>
                        )}
                      </span>
                      <ChevronRight
                        className="w-5 h-5 shrink-0 text-muted-foreground mt-0.5"
                        aria-hidden="true"
                      />
                    </Link>
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
