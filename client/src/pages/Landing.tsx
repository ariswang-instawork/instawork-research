import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { LocationSelector } from "@/components/LocationSelector";
import { SessionCard } from "@/components/SessionCard";
import { useGetSessions, getGetSessionsQueryKey, useGetSites } from "@/lib/api-client";
import type { SessionItem as Session } from "@/lib/api-client/generated/api.schemas";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeDollarSign, Clock } from "lucide-react";
import { SiteLeafletMap } from "@/components/SiteLeafletMap";
import { trackEvent } from "@/lib/analytics";

const INITIAL_SESSION_COUNT = 6;

/** "$75" for whole amounts, "$110.58" otherwise. */
function formatPay(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Minutes since midnight for the session's start time, e.g. "8:30 AM – 11:30 AM". */
function parseStartMinutes(time: string | undefined): number {
  const m = time?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}

/** Filter out sessions that have already started, then sort by date + start time. */
function upcomingSorted(sessions: Session[]): Session[] {
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return sessions
    .filter((s) => {
      if (!s.dateISO) return true;
      if (s.dateISO < todayISO) return false;
      if (s.dateISO === todayISO && parseStartMinutes(s.time) <= nowMinutes) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      const d = (a.dateISO || "").localeCompare(b.dateISO || "");
      if (d !== 0) return d;
      return parseStartMinutes(a.time) - parseStartMinutes(b.time);
    });
}

function utmProps(): Record<string, string | null> {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source"),
    campaign: params.get("utm_campaign"),
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
  };
}

const FAQ_ITEMS: { q: string; a: string }[] = [
  { q: "Do I need experience?", a: "No. Every task is guided, and a team member walks you through it." },
  { q: "Am I paid as a W-2 employee?", a: "Yes. You're a W-2 Instawork employee for every session — not a 1099 contractor." },
  { q: "How and when will I get paid?", a: "Weekly, by direct deposit through the Instawork app." },
  { q: "What should I bring?", a: "A valid photo ID. Everything else is provided." },
  { q: "Where do I finish signing up?", a: "In the Instawork app, after you pick a session." },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { site, setSite } = useSiteStorage();
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  // Incremented to open the location selector.
  const [pickerFocus, setPickerFocus] = useState(0);
  const sessionsRef = useRef<HTMLDivElement | null>(null);
  const [showAll, setShowAll] = useState(false);

  const hasCity = !!site;

  const { data, isLoading } = useGetSessions(
    { site: site?.key || "" },
    { query: { enabled: hasCity, queryKey: getGetSessionsQueryKey({ site: site?.key || "" }) } },
  );

  const sessions = useMemo(() => upcomingSorted(data?.sessions ?? []), [data?.sessions]);

  // Sites list — used to suggest the closest market with open sessions.
  const { data: sitesData } = useGetSites();
  const closestOpenMarket = useMemo(() => {
    const all = (sitesData?.sites ?? []).filter(
      (s) => s.openCount > 0 && s.key !== site?.key,
    );
    if (all.length === 0) return null;
    const current = (sitesData?.sites ?? []).find((s) => s.key === site?.key);
    if (
      current &&
      typeof current.latitude === "number" &&
      typeof current.longitude === "number"
    ) {
      const dist = (s: (typeof all)[number]) =>
        typeof s.latitude === "number" && typeof s.longitude === "number"
          ? (s.latitude - current.latitude!) ** 2 + (s.longitude - current.longitude!) ** 2
          : Number.POSITIVE_INFINITY;
      return all.slice().sort((a, b) => dist(a) - dist(b))[0];
    }
    // No coordinates for the current site — fall back to the busiest market.
    return all.slice().sort((a, b) => b.openCount - a.openCount)[0];
  }, [sitesData, site?.key]);

  // Dynamic pay: min/max of total estimated pay across available sessions.
  const payStats = useMemo(() => {
    const amounts = sessions
      .map((s) => parseFloat(s.payAmount))
      .filter((n) => Number.isFinite(n));
    if (amounts.length === 0) return null;
    return { min: Math.min(...amounts), max: Math.max(...amounts) };
  }, [sessions]);

  const singlePay = payStats && payStats.min === payStats.max ? payStats.min : null;
  // "$75" or "$66–$111"; null when unknown.
  const payText = payStats
    ? singlePay != null
      ? formatPay(singlePay)
      : `${formatPay(payStats.min)}–${formatPay(payStats.max)}`
    : null;

  // Hourly rate — leads the hero headline instead of the total.
  const rateStats = useMemo(() => {
    const rates = sessions
      .map((s) => s.payRateUsd)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (rates.length === 0) return null;
    return { min: Math.min(...rates), max: Math.max(...rates) };
  }, [sessions]);

  const singleRate = rateStats && rateStats.min === rateStats.max ? rateStats.min : null;

  useEffect(() => {
    trackEvent("research_landing_viewed", { selected_city: site?.label ?? null, ...utmProps() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToSessions = () => {
    requestAnimationFrame(() => {
      sessionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Legacy entry points (map "View openings", menu "Find sessions", header CTA).
  useEffect(() => {
    const onViewSessions = () => {
      if (!site) {
        setPickerFocus((n) => n + 1);
        return;
      }
      scrollToSessions();
    };
    window.addEventListener("iw:view-sessions", onViewSessions);
    return () => window.removeEventListener("iw:view-sessions", onViewSessions);
  }, [site]);

  // Reset per-city choices whenever the canonical site changes, no matter
  // where the change came from (picker, map popup, another tab).
  useEffect(() => {
    setShowAll(false);
  }, [site?.key]);

  const openPicker = () => setPickerFocus((n) => n + 1);

  const handleSeeSessions = () => {
    trackEvent("find_sessions_clicked", { selected_city: site?.label ?? null, ...utmProps() });
    if (!hasCity) {
      openPicker();
      return;
    }
    trackEvent("available_sessions_viewed", { selected_city: site?.label ?? null, ...utmProps() });
    scrollToSessions();
  };

  // Picking a city updates the selection and resets choice.
  const handleSiteSelected = (key: string, label: string, origin?: SiteOrigin) => {
    setSite(key, label, origin);
    setShowAll(false);
    trackEvent("research_city_selected", { selected_city: label, ...utmProps() });
  };

  // "View session" navigates to the session detail page, which shows the
  // full details card and its own "Book in the Instawork app" → "Continue
  // with Instawork" flow. Actual booking intent is tracked there, not here.
  const handleViewSession = (session: Session) => {
    trackEvent("research_session_selected", {
      selected_city: site?.label ?? null,
      selected_session_id: session.id,
      session_date: session.dateISO || session.date,
      session_start_time: session.time,
      estimated_total_pay: session.payAmount,
      ...utmProps(),
    });
    setLocation(`/sessions/${session.id}`);
  };

  const visibleSessions = showAll ? sessions : sessions.slice(0, INITIAL_SESSION_COUNT);
  const hiddenCount = sessions.length - visibleSessions.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <main className="flex-1 overflow-y-auto w-full pb-16">
        {/* ============ HERO ============ */}
        <div className="bg-background">
        <div className="max-w-[640px] mx-auto px-5 md:px-12 pt-10 md:pt-16 pb-4 text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
          <p className="text-[13px] font-bold uppercase tracking-wide text-[#3351E6] mb-3">
            Instawork Research
          </p>
          <h1 className="text-[34px] md:text-[46px] leading-[1.1] font-extrabold tracking-[-0.03em] text-[#11243e]">
            Get paid for reading <span className="text-emphasis">short voice prompts</span>
          </h1>
          <p className="text-[17px] leading-[1.5] text-[#576270] mt-4">
            Complete a 3-hour recording session at a nearby location.
          </p>

          {/* Compact benefit badges */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F8F1E2] px-3 py-1.5 text-[14px] font-semibold text-[#7C6534]">
              <BadgeDollarSign className="w-4 h-4 text-[#A17D3F]" strokeWidth={2} />
              {hasCity && isLoading ? (
                <Skeleton className="h-4 w-20 bg-muted inline-block" />
              ) : (
                <>{payText ?? "Competitive"} estimated pay</>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAEEFE] px-3 py-1.5 text-[14px] font-semibold text-[#3351E6]">
              <Clock className="w-4 h-4" strokeWidth={2} />
              In-person
            </span>
          </div>

          <div className="mt-6 text-left">
            <LocationSelector
              label={site?.label ?? null}
              focusSignal={pickerFocus}
              onSiteSelected={handleSiteSelected}
              onOpened={() =>
                trackEvent("location_selector_opened", {
                  selected_city: site?.label ?? null,
                  ...utmProps(),
                })
              }
            />
          </div>

          <button
            type="button"
            onClick={handleSeeSessions}
            className="bg-cta-gradient mt-4 w-full h-[54px] rounded-[8px] text-white text-[16px] font-semibold transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.99] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3351E6]/40"
          >
            Book sessions near me
          </button>

          <p className="text-[14px] text-[#576270] mt-3 text-center">
            This opportunity is not currently available to residents of Texas, Washington, or Illinois.
          </p>
        </div>
        </div>

        {/* ============ SESSIONS ============ */}
        <section
          id="sessions"
          ref={sessionsRef}
          className="scroll-mt-20 mt-12 md:mt-16 bg-[#FCFBF9] py-12 md:py-16"
        >
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
              {hasCity ? `Available sessions near ${site!.label}` : "Available sessions"}
            </h2>
            <p className="text-[16px] text-[#576270] mt-1.5">
              Choose a time and finish booking in Instawork.
              {hasCity && (
                <button
                  type="button"
                  onClick={openPicker}
                  className="text-[#3351E6] underline underline-offset-2 font-medium ml-1.5"
                >
                  Change location
                </button>
              )}
            </p>

            <div className="mt-7">
              {!hasCity ? (
                <div className="py-8 text-center max-w-[480px] mx-auto">
                  <p className="text-[17px] font-semibold text-[#11243e]">
                    Enter your city to see sessions near you.
                  </p>
                  <button
                    type="button"
                    onClick={openPicker}
                    className="mt-4 inline-flex items-center justify-center h-12 px-6 rounded-[8px] border border-[#3351E6] text-[#3351E6] font-semibold text-[15px] active:opacity-80"
                  >
                    Enter your city
                  </button>
                </div>
              ) : isLoading ? (
                <div className="space-y-3.5 divide-y divide-[#EEE9DD] border-t border-b border-[#EEE9DD]">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-[52px] w-full bg-muted" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-8 text-center max-w-[480px] mx-auto">
                  <p className="text-[17px] font-semibold text-[#11243e]">
                    No sessions are currently open near this location.
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={openPicker}
                      className="inline-flex items-center justify-center h-12 px-6 rounded-[8px] border border-[#3351E6] text-[#3351E6] font-semibold text-[15px] active:opacity-80"
                    >
                      Change location
                    </button>
                    {closestOpenMarket && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSiteSelected(closestOpenMarket.key, closestOpenMarket.label)
                        }
                        className="inline-flex items-center justify-center h-12 px-6 rounded-[8px] border border-[#3351E6] text-[#3351E6] font-semibold text-[15px] active:opacity-80"
                      >
                        View sessions in {closestOpenMarket.label}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-[#EEE9DD] border-t border-b border-[#EEE9DD]">
                    {visibleSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onBook={() => handleViewSession(session)}
                      />
                    ))}
                  </ul>
                  {hiddenCount > 0 && (
                    <div className="mt-6 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAll(true);
                          trackEvent("see_more_sessions_clicked", {
                            selected_city: site?.label ?? null,
                            ...utmProps(),
                          });
                        }}
                        className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-[8px] border border-[#E0DCCF] bg-white text-[#11243e] font-semibold text-[15px] active:opacity-80"
                      >
                        View more sessions ({hiddenCount})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

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
          </div>
        </section>

        {/* ============ EXPLORE OTHER LOCATIONS ============ */}
        <section className="bg-[#FCFBF9] py-14 md:py-20">
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
              Explore other locations
            </h2>
            <p className="text-[16px] text-[#576270] mt-1.5">
              Sessions run in cities across the country. Find one near you.
            </p>
            <div className="mt-6 rounded-[16px] overflow-hidden border border-[#EEE9DD]">
              <SiteLeafletMap />
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" className="scroll-mt-20 bg-white py-14 md:py-20">
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <div className="max-w-[760px]">
              <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
                FAQ
              </h2>
              <p className="text-[16px] text-[#576270] mt-1.5">
                Answers to common questions.
              </p>
              <div className="mt-6 border-t border-[#EEE9DD]">
                {FAQ_ITEMS.map(({ q, a }) => (
                  <details key={q} className="group border-b border-[#EEE9DD] py-6">
                    <summary className="flex items-center justify-between gap-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[19px] md:text-[23px] font-bold leading-snug text-[#11243e]">
                      {q}
                      <span className="shrink-0 text-[26px] leading-none font-normal text-[#A17D3F] group-open:hidden">
                        +
                      </span>
                      <span className="hidden shrink-0 text-[26px] leading-none font-normal text-[#A17D3F] group-open:inline">
                        –
                      </span>
                    </summary>
                    <p className="text-[16px] text-[#576270] mt-3 leading-relaxed max-w-[600px]">{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      <EligibilityCheckDrawer
        hideTrigger
        open={eligibilityOpen}
        onOpenChange={setEligibilityOpen}
      />
    </div>
  );
}
