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
    <div className="p-4 md:p-5 rounded-[12px] border border-blue-200 bg-blue-50 text-[15px] md:text-[16px] text-blue-950 lg:col-span-2">
      <div className="flex gap-3">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-700" aria-hidden="true" />
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
    <div className="space-y-6">
      <div className="flex gap-6 border-b border-[#EEE9DD]">
        <button
          onClick={() => setTab("remaining")}
          className={`px-1 py-3 md:py-4 text-[15px] md:text-[16px] font-semibold border-b-2 transition-colors ${
            tab === "remaining"
              ? "border-[#3351E6] text-[#3351E6]"
              : "border-transparent text-[#576270] hover:text-[#11243e]"
          }`}
        >
          Remaining
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-1 py-3 md:py-4 text-[15px] md:text-[16px] font-semibold border-b-2 transition-colors ${
            tab === "history"
              ? "border-[#3351E6] text-[#3351E6]"
              : "border-transparent text-[#576270] hover:text-[#11243e]"
          }`}
        >
          History
        </button>
      </div>

      <div>
        {eligibility.isLoading ? (
          <div className="space-y-3">
            <div className="h-14 rounded-xl bg-muted animate-pulse" />
            <div className="h-14 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : eligibility.isError ? (
          <div className="p-5 rounded-[12px] text-[15px] md:text-[16px] font-medium border bg-destructive/10 text-destructive border-destructive/20">
            Could not check eligibility right now.
            <span className="block mt-1 font-normal opacity-70">
              {eligibility.error instanceof Error ? eligibility.error.message : "unknown"}
            </span>
          </div>
        ) : eligibility.data && eligibility.data.sites.length === 0 ? (
          <div className="p-5 rounded-[12px] text-[15px] md:text-[16px] font-medium border bg-white text-[#576270] border-[#EEE9DD]">
            No session locations available right now.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <SessionLimitPolicyNotice />
            {tab === "remaining"
              ? eligibility.data?.sites.map((s) =>
                  s.isBlocked || s.remaining <= 0 ? (
                    <div
                      key={s.businessId}
                      className={`p-5 md:p-6 rounded-[12px] border ${
                        s.isBlocked
                          ? "bg-amber-50 border-amber-200"
                          : "bg-white border-[#EEE9DD]"
                      }`}
                    >
                      <p className="text-[17px] md:text-[18px] font-bold text-[#11243e]">
                        {s.siteLabel ?? "Session site"}
                      </p>
                      {s.isBlocked ? (
                        <p className="text-[15px] md:text-[16px] font-medium text-amber-900 mt-1">
                          You can't book more sessions at this site.
                        </p>
                      ) : (
                        <p className="text-[15px] md:text-[16px] text-[#576270] mt-1">
                          {s.remaining} of {s.cap} session{s.cap === 1 ? "" : "s"} remaining
                        </p>
                      )}
                      {s.oneVisitLimit && (
                        <p className="text-[15px] md:text-[16px] text-blue-900/80 mt-2 leading-relaxed">
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
                      className="flex items-start justify-between gap-4 p-5 md:p-6 rounded-[12px] border bg-white border-[#EEE9DD] text-left transition-colors hover:border-[#D9D3C4] hover:bg-[#FAFAF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3351E6]/40"
                    >
                      <span className="min-w-0">
                        <span className="block text-[17px] md:text-[18px] font-bold text-[#11243e]">
                          {s.siteLabel ?? "Session site"}
                        </span>
                        <span className="block text-[15px] md:text-[16px] text-[#576270] mt-1">
                          {s.remaining} of {s.cap} session{s.cap === 1 ? "" : "s"} remaining
                        </span>
                        {s.oneVisitLimit && (
                          <span className="block text-[15px] md:text-[16px] text-blue-900/80 mt-2 leading-relaxed">
                            New York: one visit limit. Additional visits are by invitation only.
                          </span>
                        )}
                      </span>
                      <ChevronRight
                        className="w-5 h-5 shrink-0 text-[#576270] mt-1"
                        aria-hidden="true"
                      />
                    </Link>
                  ),
                )
              : eligibility.data?.sites.map((s) => (
                  <div
                    key={s.businessId}
                    className="p-5 md:p-6 rounded-[12px] border border-[#EEE9DD] bg-white"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="text-[17px] md:text-[18px] font-bold text-[#11243e]">
                          {s.siteLabel ?? "Session site"}
                        </p>
                        {s.oneVisitLimit && (
                          <p className="text-[15px] md:text-[16px] text-blue-900/80 mt-1 leading-relaxed">
                            New York: one visit limit. Additional visits are by invitation only.
                          </p>
                        )}
                      </div>
                      {s.isBlocked && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0">
                          Maxed out
                        </span>
                      )}
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-[15px] md:text-[16px]">
                        <span className="text-[#576270]">Booked</span>
                        <span className="font-medium text-[#11243e]">{s.bookedCount}</span>
                      </div>
                      <div className="flex justify-between text-[15px] md:text-[16px]">
                        <span className="text-[#576270]">Completed</span>
                        <span className="font-medium text-[#11243e]">{s.completedCount}</span>
                      </div>
                      <div className="flex justify-between text-[15px] md:text-[16px] border-t border-[#EEE9DD] pt-2.5 mt-2.5">
                        <span className="font-semibold text-[#11243e]">Remaining</span>
                        <span className="font-bold text-[#3351E6]">
                          {s.remaining}/{s.cap}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}
