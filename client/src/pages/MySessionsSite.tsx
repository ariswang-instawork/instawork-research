import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { SessionLimitPolicyNotice } from "@/components/EligibilityPanel";
import { SessionCalendar } from "@/components/SessionCalendar";
import { BackLink } from "@/components/BackLink";
import {
  useAuthStatus,
  useEligibility,
  useEligibilitySessions,
} from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import type { SessionItem } from "@/lib/api-client/generated/api.schemas";

export default function MySessionsSite() {
  const [, params] = useRoute("/my-sessions/:businessId");
  const [, setLocation] = useLocation();
  const raw = params?.businessId ?? "";
  const businessId = /^\d+$/.test(raw) ? Number(raw) : null;
  const returnTo = businessId != null ? `/my-sessions/${businessId}` : "/my-sessions";

  useEffect(() => {
    if (businessId != null) {
      trackEvent("my_sessions_site_page_viewed", { business_id: businessId });
    }
  }, [businessId]);

  const { data: auth, isLoading: authLoading } = useAuthStatus();
  const isAuthenticated = !!auth?.authenticated;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
      window.dispatchEvent(
        new CustomEvent("iw:login-required", { detail: { returnTo } }),
      );
    }
  }, [authLoading, isAuthenticated, returnTo, setLocation]);

  const eligibility = useEligibility(isAuthenticated && businessId != null);
  const site = eligibility.data?.sites.find((s) => s.businessId === businessId);
  const sessionsQuery = useEligibilitySessions(
    businessId,
    isAuthenticated && businessId != null && !!site && !site.isBlocked,
  );
  const sessions = sessionsQuery.data?.sessions ?? [];

  const handleBook = (s: SessionItem) => {
    if (!site) return;
    trackEvent("eligibility_shift_book_clicked", {
      business_id: site.businessId,
      session_id: s.id,
    });
    if (s.bookUrl) window.open(s.bookUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FCFBF9]">
      <main className="flex-1 overflow-y-auto py-14 md:py-20 lg:py-24">
        <div className="max-w-[1200px] mx-auto px-5 md:px-12 w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="max-w-[720px]">
            <BackLink href="/my-sessions" label="My sessions" />

            {businessId == null ? (
              <NotFound />
            ) : authLoading || !isAuthenticated || eligibility.isLoading ? (
              <div className="space-y-4">
                <div className="h-10 w-2/3 rounded-xl bg-muted animate-pulse" />
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
            ) : !site ? (
              <NotFound />
            ) : (
              <>
                <h1 className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
                  {site.siteLabel ?? "Session site"}
                </h1>
                {site.isBlocked ? (
                  <p className="text-[16px] font-medium text-[#B4791F] mt-1.5">
                    You can't book more sessions here.
                  </p>
                ) : (
                  <p className="text-[16px] text-[#576270] mt-1.5">
                    {site.remaining} of {site.cap} session{site.cap === 1 ? "" : "s"} remaining
                  </p>
                )}
                {site.oneVisitLimit && (
                  <p className="text-[14px] md:text-[15px] text-[#5B6EE8] mt-1">
                    New York: one visit limit
                  </p>
                )}

                <div className="mt-8 space-y-4">
                  <SessionLimitPolicyNotice />
                  {site.isBlocked ? null : sessionsQuery.isLoading ? (
                    <div className="space-y-2">
                      <div className="h-12 rounded-lg bg-muted animate-pulse" />
                      <div className="h-12 rounded-lg bg-muted animate-pulse" />
                    </div>
                  ) : sessionsQuery.isError ? (
                    <p className="text-[15px] md:text-[16px] text-[#576270]">
                      Couldn't load shifts right now.
                    </p>
                  ) : (
                    <SessionCalendar sessions={sessions} onBook={handleBook} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div>
      <h1 className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
        Site not found
      </h1>
      <p className="text-[16px] text-[#576270] mt-1.5">
        This location isn't available right now.
      </p>
      <BackLink href="/my-sessions" label="Back to my sessions" className="mt-4 mb-0" />
    </div>
  );
}
