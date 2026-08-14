import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { LocationSelector } from "@/components/LocationSelector";
import { SessionCalendar } from "@/components/SessionCalendar";
import { useGetSessions, getGetSessionsQueryKey, useGetSites } from "@/lib/api-client";
import { useAuthStatus, login, DEFAULT_LOGIN_RETURN } from "@/hooks/use-auth";
import type { SessionItem as Session } from "@/lib/api-client/generated/api.schemas";
import { Skeleton } from "@/components/ui/skeleton";
import { TestimonialMarquee } from "@/components/TestimonialMarquee";
import { TESTIMONIALS, BOOKING_TIPS } from "@/lib/testimonials";
import { trackEvent } from "@/lib/analytics";
import { EXCLUDED_STATES } from "@/lib/constants";

/** Shared scale for landing page section titles. */
const SECTION_HEADING =
  "text-[32px] md:text-[40px] lg:text-[48px] leading-[1.15] font-bold tracking-tight text-[#11243e]";

/** Hero headline — as large as fits one line in the 1200px container on lg+ screens. */
const HERO_HEADING =
  "text-[36px] sm:text-[42px] md:text-[48px] lg:text-[54px] xl:text-[60px] leading-[1.08] font-bold tracking-tight text-[#11243e]";

/** Hero body copy — darker and larger than section subtitles. */
const HERO_BODY =
  "text-[18px] md:text-[20px] lg:text-[22px] leading-[1.55] text-[#11243e]/80";

/** Shared subtitle under section headings (below the fold). */
const SECTION_SUBTITLE =
  "text-[18px] md:text-[20px] leading-[1.5] text-[#576270] mt-2";

/** Check if a location is in an excluded state */
function isLocationExcluded(label: string | null | undefined): boolean {
  if (!label) return false;
  return EXCLUDED_STATES.some(state => label.includes(state));
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
  { q: "How and when will I get paid?", a: "Weekly, by direct deposit through the Instawork app." },
  { q: "What should I bring?", a: "A valid photo ID. Everything else is provided." },
  { q: "Where do I finish signing up?", a: "In the Instawork app, after you pick a session." },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { site, setSite } = useSiteStorage();
  // Incremented to open the location selector.
  const [pickerFocus, setPickerFocus] = useState(0);
  const sessionsRef = useRef<HTMLDivElement | null>(null);
  const testimonialsRef = useRef<HTMLDivElement | null>(null);
  const tipsRef = useRef<HTMLDivElement | null>(null);
  const [sessionsRevealed, setSessionsRevealed] = useState(false);

  const { data: auth } = useAuthStatus();
  const isAuthenticated = !!auth?.authenticated;

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

  useEffect(() => {
    trackEvent("research_landing_viewed", { selected_city: site?.label ?? null, ...utmProps() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire a "viewed" event the first time the trust sections scroll into view.
  const siteLabelRef = useRef<string | null>(null);
  siteLabelRef.current = site?.label ?? null;
  useEffect(() => {
    const targets = [
      [testimonialsRef.current, "testimonials_viewed"] as const,
      [tipsRef.current, "booking_tips_viewed"] as const,
    ].filter(([el]) => el);
    if (targets.length === 0) return;
    const fired = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const name = (entry.target as HTMLElement).dataset.track;
          if (entry.isIntersecting && name && !fired.has(name)) {
            fired.add(name);
            trackEvent(name, { selected_city: siteLabelRef.current, ...utmProps() });
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.3 },
    );
    targets.forEach(([el]) => io.observe(el as Element));
    return () => io.disconnect();
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
      setSessionsRevealed(true);
      scrollToSessions();
    };
    window.addEventListener("iw:view-sessions", onViewSessions);
    return () => window.removeEventListener("iw:view-sessions", onViewSessions);
  }, [site]);

  // Reset per-city choices whenever the canonical site changes, no matter
  // where the change came from (picker, map popup, another tab).
  useEffect(() => {
    setSessionsRevealed(false);
  }, [site?.key]);

  const openPicker = () => setPickerFocus((n) => n + 1);

  const handleFindSessions = () => {
    trackEvent("find_sessions_clicked", { selected_city: site?.label ?? null, ...utmProps() });
    if (!hasCity) {
      openPicker();
      return;
    }
    setSessionsRevealed(true);
    trackEvent("available_sessions_viewed", { selected_city: site?.label ?? null, ...utmProps() });
    scrollToSessions();
  };

  const handleReturningPath = () => {
    trackEvent("returning_user_path_clicked", { selected_city: site?.label ?? null, ...utmProps() });
    if (isAuthenticated) setLocation(DEFAULT_LOGIN_RETURN);
    else login();
  };

  // Picking a city updates the selection.
  const handleSiteSelected = (key: string, label: string, origin?: SiteOrigin) => {
    setSite(key, label, origin);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <main className="flex-1 overflow-y-auto w-full pb-16">
        {/* ============ HERO ============ */}
        <div className="bg-background">
        <div className="max-w-[1200px] mx-auto px-5 md:px-12 pt-12 md:pt-20 pb-12 md:pb-16">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <span className="inline-flex items-center rounded-full bg-[#11243e] px-5 py-2 md:px-6 md:py-2.5 text-[14px] md:text-[16px] font-semibold text-white tracking-wide mb-8 md:mb-6">
              Instawork Research
            </span>
            <h1 className={HERO_HEADING}>
              <span className="lg:whitespace-nowrap">
                Get paid for reading{" "}
                <span className="text-emphasis">short voice prompts</span>
              </span>
            </h1>
            <div className="mt-5 md:mt-6 space-y-2">
              <p className={HERO_BODY}>
                Complete a 3-hour recording session at a nearby location.
              </p>
              <p className={`${HERO_BODY} hidden md:block lg:whitespace-nowrap`}>
                No experience needed — simple instructions on site, paid through Instawork.
              </p>
            </div>

            <div className="mt-8 md:mt-10 w-full max-w-[480px]">
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
              {site && isLocationExcluded(site.label) && (
                <p className="text-[13px] text-[#E04B4D] font-medium mt-2 bg-[#FCE8E8] rounded-[8px] px-3 py-2">
                  This opportunity is not available in your location.
                </p>
              )}

              <button
                type="button"
                onClick={handleFindSessions}
                disabled={isLocationExcluded(site?.label ?? null)}
                className={`mt-4 w-full h-[54px] rounded-[8px] text-white text-[16px] font-semibold transition-[transform,filter] duration-150 ${
                  isLocationExcluded(site?.label ?? null)
                    ? "bg-gray-400 opacity-50 cursor-not-allowed"
                    : "bg-cta-gradient hover:brightness-105 active:scale-[0.99] active:brightness-95"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3351E6]/40`}
              >
                Find Sessions Near Me
              </button>

              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={handleReturningPath}
                  className="mt-5 text-left group"
                >
                  <span className="block text-[16px] md:text-[17px] font-medium text-[#11243e]">
                    Already booked with us?
                  </span>
                  <span className="mt-1 inline-flex items-center gap-2 text-[16px] md:text-[17px] font-medium text-[#11243e] group-hover:text-[#3351E6] transition-colors">
                    Log in to see your sessions
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* ============ SESSIONS (revealed on demand) ============ */}
        {sessionsRevealed && (
        <section
          id="sessions"
          ref={sessionsRef}
          className="scroll-mt-20 bg-[#FCFBF9] py-14 md:py-20 lg:py-24"
        >
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <h2 className={SECTION_HEADING}>
              {hasCity ? (
                <>
                  Available sessions in{" "}
                  <span className="block md:inline">{site!.label}</span>
                </>
              ) : (
                "Available sessions"
              )}
            </h2>
            <p className={SECTION_SUBTITLE}>
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
                  <p className="text-[17px] md:text-[18px] font-semibold text-[#11243e]">
                    Enter your city to see sessions near you.
                  </p>
                  <button
                    type="button"
                    onClick={openPicker}
                    className="mt-4 inline-flex items-center justify-center h-12 px-6 rounded-[8px] border border-[#3351E6] text-[#3351E6] font-semibold text-[16px] active:opacity-80"
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
                  <p className="text-[17px] md:text-[18px] font-semibold text-[#11243e]">
                    No sessions are currently open near this location.
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={openPicker}
                      className="inline-flex items-center justify-center h-12 px-6 rounded-[8px] border border-[#3351E6] text-[#3351E6] font-semibold text-[16px] active:opacity-80"
                    >
                      Change location
                    </button>
                    {closestOpenMarket && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSiteSelected(closestOpenMarket.key, closestOpenMarket.label)
                        }
                        className="inline-flex items-center justify-center h-12 px-6 rounded-[8px] border border-[#3351E6] text-[#3351E6] font-semibold text-[16px] active:opacity-80"
                      >
                        View sessions in {closestOpenMarket.label}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <SessionCalendar
                  sessions={sessions}
                  onBook={handleViewSession}
                  actionLabel="View session"
                />
              )}
            </div>

          </div>
        </section>
        )}

        {/* ============ TESTIMONIALS (rolling) ============ */}
        <section className="bg-[#FCFBF9] py-14 md:py-20 lg:py-24">
          <div ref={testimonialsRef} data-track="testimonials_viewed" className="max-w-[1200px] mx-auto px-5 md:px-12">
            <h2 className={SECTION_HEADING}>
              Pros rate these sessions 5★
            </h2>
            <p className={SECTION_SUBTITLE}>
              5-star ratings from Instawork Pros who&apos;ve completed a session.
            </p>
          </div>
          <TestimonialMarquee items={TESTIMONIALS} />
        </section>

        {/* ============ WHAT TO KNOW BEFORE YOU BOOK (tips) ============ */}
        <section className="bg-background py-14 md:py-20 lg:py-24">
          <div ref={tipsRef} data-track="booking_tips_viewed" className="max-w-[1200px] mx-auto px-5 md:px-12">
            <div className="max-w-[760px]">
              <h2 className={SECTION_HEADING}>
                What to know before you book
              </h2>
              <p className={SECTION_SUBTITLE}>
                Tips from Pros who&apos;ve been there.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {BOOKING_TIPS.map((t) => (
                  <div
                    key={`${t.name}-${t.city}`}
                    className="rounded-[14px] border border-[#EEE9DD] bg-white px-5 py-4"
                  >
                    <p className="text-[15px] md:text-[16px] leading-relaxed text-[#11243e]">
                      {t.tip}
                    </p>
                    <p className="text-[13px] text-[#8A93A0] mt-2.5">
                      — {t.name} · {t.city}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" className="scroll-mt-20 bg-[#EEE9DD] py-16 md:py-20 lg:py-24">
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <div className="max-w-[760px]">
              <h2 className="text-[32px] md:text-[40px] lg:text-[48px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
                FAQ
              </h2>
              <p className={SECTION_SUBTITLE}>
                Answers to common questions.
              </p>
              <div className="mt-8 border-t border-[#D0C5B0]">
                {FAQ_ITEMS.map(({ q, a }) => (
                  <details key={q} className="group border-b border-[#D0C5B0] py-5">
                    <summary className="flex items-center justify-between gap-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[20px] md:text-[24px] font-bold leading-[1.25] text-[#11243e]">
                      {q}
                      <span className="shrink-0 text-[28px] leading-none font-normal text-[#A17D3F] group-open:hidden">
                        +
                      </span>
                      <span className="hidden shrink-0 text-[28px] leading-none font-normal text-[#A17D3F] group-open:inline">
                        –
                      </span>
                    </summary>
                    <p className="text-[16px] text-[#576270] mt-4 leading-relaxed max-w-[600px]">{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
