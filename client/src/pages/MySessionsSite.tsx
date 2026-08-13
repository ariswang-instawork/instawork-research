import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
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
      <main className="flex-1 overflow-y-auto py-10 md:py-16 lg:py-20">
        <div className="max-w-[1200px] mx-auto px-5 md:px-12 w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Link
            href="/my-sessions"
            className="inline-flex items-center gap-2 mb-6 text-[15px] md:text-[16px] font-medium text-[#576270] hover:text-[#11243e] transition-colors"
            aria-label="Back to your sessions"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to your sessions
          </Link>

          {businessId == null ? (
            <NotFound />
          ) : authLoading || !isAuthenticated ? (
            <div className="space-y-4 max-w-3xl">
              <div className="h-10 w-2/3 rounded-xl bg-muted animate-pulse" />
              <div className="h-16 rounded-xl bg-muted animate-pulse" />
              <div className="h-16 rounded-xl bg-muted animate-pulse" />
            </div>
          ) : eligibility.isLoading ? (
            <div className="space-y-4 max-w-3xl">
              <div className="h-10 w-2/3 rounded-xl bg-muted animate-pulse" />
              <div className="h-16 rounded-xl bg-muted animate-pulse" />
              <div className="h-16 rounded-xl bg-muted animate-pulse" />
            </div>
          ) : eligibility.isError ? (
            <div className="max-w-3xl p-5 rounded-[12px] text-[15px] md:text-[16px] font-medium border bg-destructive/10 text-destructive border-destructive/20">
              Could not check eligibility right now.
              <span className="block mt-1 font-normal opacity-70">
                {eligibility.error instanceof Error ? eligibility.error.message : "unknown"}
              </span>
            </div>
          ) : !site ? (
            <NotFound />
          ) : (
            <div className="max-w-3xl">
              <h1 className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
                {site.siteLabel ?? "Session site"}
              </h1>
              {site.isBlocked ? (
                <p className="text-[16px] font-medium text-amber-900 mt-1.5">
                  You can't book more sessions at this site.
                </p>
              ) : (
                <p className="text-[16px] text-[#576270] mt-1.5">
                  {site.remaining} of {site.cap} session{site.cap === 1 ? "" : "s"} remaining
                </p>
              )}
              {site.oneVisitLimit && (
                <p className="text-[15px] md:text-[16px] text-blue-900/80 mt-2 leading-relaxed">
                  New York: one visit limit. Additional visits are by invitation only.
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
                  <p className="text-[15px] md:text-[16px] text-[#576270]">Couldn't load shifts right now.</p>
                ) : sessions.length === 0 ? (
                  <p className="text-[15px] md:text-[16px] text-[#576270]">No open shifts right now.</p>
                ) : (
                  <ul className="divide-y divide-[#EEE9DD] border-t border-b border-[#EEE9DD] bg-white rounded-[12px] overflow-hidden">
                    {sessions.map((s) => (
                      <li
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
        Site not found
      </h1>
      <p className="text-[16px] text-[#576270] mt-1.5">
        This location isn't available right now.
      </p>
      <Link
        href="/my-sessions"
        className="inline-flex mt-4 text-[16px] font-semibold text-[#3351E6] underline underline-offset-2"
      >
        Back to your sessions
      </Link>
    </div>
  );
}
