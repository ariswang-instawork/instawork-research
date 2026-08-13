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
    <div className="flex-1 flex flex-col bg-background">
      <main className="flex-1 overflow-y-auto px-5 md:px-6">
        <div className="max-w-md md:max-w-2xl mx-auto w-full pt-5 md:pt-10 pb-24 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Link
            href="/my-sessions"
            className="inline-flex items-center mb-6 -ml-1"
            aria-label="Back to your sessions"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>

          {businessId == null ? (
            <NotFound />
          ) : authLoading || !isAuthenticated ? (
            <div className="space-y-3">
              <div className="h-8 w-2/3 rounded-xl bg-muted animate-pulse" />
              <div className="h-14 rounded-xl bg-muted animate-pulse" />
              <div className="h-14 rounded-xl bg-muted animate-pulse" />
            </div>
          ) : eligibility.isLoading ? (
            <div className="space-y-3">
              <div className="h-8 w-2/3 rounded-xl bg-muted animate-pulse" />
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
          ) : !site ? (
            <NotFound />
          ) : (
            <>
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#11243e]">
                {site.siteLabel ?? "Session site"}
              </h1>
              {site.isBlocked ? (
                <p className="text-[15px] font-medium text-amber-900 mt-1.5">
                  You can't book more sessions at this site.
                </p>
              ) : (
                <p className="text-[15px] text-muted-foreground mt-1.5">
                  {site.remaining} of {site.cap} session{site.cap === 1 ? "" : "s"} remaining
                </p>
              )}
              {site.oneVisitLimit && (
                <p className="text-sm text-blue-900/80 mt-2 leading-relaxed">
                  New York: one visit limit. Additional visits are by invitation only.
                </p>
              )}

              <div className="mt-6 space-y-3">
                <SessionLimitPolicyNotice />
                {site.isBlocked ? null : sessionsQuery.isLoading ? (
                  <div className="space-y-2">
                    <div className="h-10 rounded-lg bg-muted animate-pulse" />
                    <div className="h-10 rounded-lg bg-muted animate-pulse" />
                  </div>
                ) : sessionsQuery.isError ? (
                  <p className="text-sm text-muted-foreground">Couldn't load shifts right now.</p>
                ) : sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open shifts right now.</p>
                ) : (
                  <ul className="divide-y divide-[hsl(var(--border))] border-t border-b border-[hsl(var(--border))]">
                    {sessions.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                        <span className="text-[15px] text-gray-900 min-w-0 truncate">
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
      <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#11243e]">
        Site not found
      </h1>
      <p className="text-[15px] text-muted-foreground mt-1.5">
        This location isn't available right now.
      </p>
      <Link
        href="/my-sessions"
        className="inline-flex mt-4 text-[15px] font-semibold text-[#3351E6] underline underline-offset-2"
      >
        Back to your sessions
      </Link>
    </div>
  );
}
