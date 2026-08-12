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
