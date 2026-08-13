import { useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { SessionLimitPolicyNotice } from "@/components/EligibilityPanel";
import {
  useAuthStatus,
  useEligibility,
  useEligibilitySessions,
} from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

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

  return (
    <div className="flex-1 flex flex-col bg-[#FCFBF9]">
      <main className="flex-1 overflow-y-auto py-12 md:py-16 lg:py-20">
        <div className="max-w-[720px] mx-auto px-5 md:px-8 w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Link
            href="/my-sessions"
            className="inline-flex items-center text-[15px] font-medium text-[#8A93A0] hover:text-[#11243e] transition-colors mb-6"
          >
            My sessions
          </Link>

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
              <h1 className="text-[32px] md:text-[40px] lg:text-[44px] leading-[1.1] font-bold tracking-tight text-[#11243e]">
                {site.siteLabel ?? "Session site"}
              </h1>
              {site.isBlocked ? (
                <p className="text-[16px] md:text-[17px] font-medium text-[#B4791F] mt-2">
                  You can't book more sessions here.
                </p>
              ) : (
                <p className="text-[16px] md:text-[17px] text-[#8A93A0] mt-2">
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
                  <p className="text-[15px] md:text-[16px] text-[#8A93A0]">
                    Couldn't load shifts right now.
                  </p>
                ) : sessions.length === 0 ? (
                  <p className="text-[15px] md:text-[16px] text-[#8A93A0]">
                    No open shifts right now.
                  </p>
                ) : (
                  <div className="rounded-[14px] border border-[#EEE9DD] bg-white overflow-hidden divide-y divide-[#EEE9DD]">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-4 px-5 py-4 md:py-5"
                      >
                        <span className="text-[17px] md:text-[18px] font-semibold text-[#11243e] min-w-0 truncate">
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
                          className="shrink-0 text-[15px] md:text-[16px] font-semibold text-white bg-cta-gradient rounded-[8px] px-5 py-2.5 hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3351E6]/40"
                        >
                          Book
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div>
      <h1 className="text-[32px] md:text-[40px] lg:text-[44px] leading-[1.1] font-bold tracking-tight text-[#11243e]">
        Site not found
      </h1>
      <p className="text-[16px] md:text-[17px] text-[#8A93A0] mt-2">
        This location isn't available right now.
      </p>
      <Link
        href="/my-sessions"
        className="inline-flex mt-4 text-[16px] font-semibold text-[#3351E6] underline underline-offset-2"
      >
        Back to my sessions
      </Link>
    </div>
  );
}
