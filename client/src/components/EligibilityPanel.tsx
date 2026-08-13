import { useState } from "react";
import { Info, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import {
  useAuthStatus,
  useEligibility,
} from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

/** One incidental line summarizing per-site booking limits. */
export function SessionLimitPolicyNotice() {
  return (
    <p className="flex items-start gap-2 text-[14px] md:text-[15px] text-[#8A93A0] leading-relaxed">
      <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span>Most sites allow 3 sessions; New York allows 1 visit.</span>
    </p>
  );
}

/** Rounded container that groups list rows with inset hairline dividers. */
function GroupedList({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-[#EEE9DD] bg-white overflow-hidden divide-y divide-[#EEE9DD]">
      {children}
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

  const tabClass = (active: boolean) =>
    `pb-3 -mb-px text-[15px] md:text-[16px] font-semibold border-b-2 transition-colors ${
      active
        ? "border-[#3351E6] text-[#3351E6]"
        : "border-transparent text-[#8A93A0] hover:text-[#11243e]"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex gap-7 border-b border-[#EEE9DD]">
        <button onClick={() => setTab("remaining")} className={tabClass(tab === "remaining")}>
          Remaining
        </button>
        <button onClick={() => setTab("history")} className={tabClass(tab === "history")}>
          History
        </button>
      </div>

      {eligibility.isLoading ? (
        <div className="space-y-3">
          <div className="h-16 rounded-xl bg-muted animate-pulse" />
          <div className="h-16 rounded-xl bg-muted animate-pulse" />
        </div>
      ) : eligibility.isError ? (
        <div className="p-5 rounded-[14px] text-[15px] font-medium border border-destructive/20 bg-destructive/10 text-destructive">
          Could not check eligibility right now.
          <span className="block mt-1 font-normal opacity-70">
            {eligibility.error instanceof Error ? eligibility.error.message : "unknown"}
          </span>
        </div>
      ) : eligibility.data && eligibility.data.sites.length === 0 ? (
        <p className="text-[15px] md:text-[16px] text-[#576270]">
          No session locations available right now.
        </p>
      ) : (
        <div className="space-y-4">
          <SessionLimitPolicyNotice />
          {tab === "remaining" ? (
            <GroupedList>
              {eligibility.data?.sites.map((s) => {
                const blocked = s.isBlocked || s.remaining <= 0;
                const detail = (
                  <span className="min-w-0">
                    <span className="block text-[17px] md:text-[18px] font-semibold text-[#11243e]">
                      {s.siteLabel ?? "Session site"}
                    </span>
                    {s.isBlocked ? (
                      <span className="block text-[15px] text-[#B4791F] mt-0.5">
                        You can't book more sessions here.
                      </span>
                    ) : (
                      <span className="block text-[15px] text-[#8A93A0] mt-0.5">
                        {s.remaining} of {s.cap} session{s.cap === 1 ? "" : "s"} remaining
                      </span>
                    )}
                    {s.oneVisitLimit && (
                      <span className="block text-[14px] text-[#5B6EE8] mt-1">
                        New York: one visit limit
                      </span>
                    )}
                  </span>
                );
                return blocked ? (
                  <div
                    key={s.businessId}
                    className="flex items-center justify-between gap-4 px-5 py-4 md:py-5"
                  >
                    {detail}
                  </div>
                ) : (
                  <Link
                    key={s.businessId}
                    href={`/my-sessions/${s.businessId}`}
                    onClick={() =>
                      trackEvent("eligibility_site_expanded", { business_id: s.businessId })
                    }
                    className="flex items-center justify-between gap-4 px-5 py-4 md:py-5 transition-colors hover:bg-[#FAFAF8] focus-visible:outline-none focus-visible:bg-[#FAFAF8]"
                  >
                    {detail}
                    <ChevronRight className="w-5 h-5 shrink-0 text-[#C4CAD2]" aria-hidden="true" />
                  </Link>
                );
              })}
            </GroupedList>
          ) : (
            <GroupedList>
              {eligibility.data?.sites.map((s) => (
                <div key={s.businessId} className="px-5 py-4 md:py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[17px] md:text-[18px] font-semibold text-[#11243e]">
                        {s.siteLabel ?? "Session site"}
                      </p>
                      {s.oneVisitLimit && (
                        <p className="text-[14px] text-[#5B6EE8] mt-0.5">
                          New York: one visit limit
                        </p>
                      )}
                    </div>
                    {s.isBlocked && (
                      <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                        Maxed out
                      </span>
                    )}
                  </div>
                  <dl className="mt-3 space-y-2 text-[15px]">
                    <div className="flex justify-between">
                      <dt className="text-[#8A93A0]">Booked</dt>
                      <dd className="font-medium text-[#11243e]">{s.bookedCount}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#8A93A0]">Completed</dt>
                      <dd className="font-medium text-[#11243e]">{s.completedCount}</dd>
                    </div>
                    <div className="flex justify-between border-t border-[#EEE9DD] pt-2 mt-2">
                      <dt className="font-semibold text-[#11243e]">Remaining</dt>
                      <dd className="font-bold text-[#3351E6]">
                        {s.remaining}/{s.cap}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </GroupedList>
          )}
        </div>
      )}
    </div>
  );
}
