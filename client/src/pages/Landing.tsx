import { useEffect, useMemo, useRef, useState } from "react";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { login } from "@/hooks/use-auth";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { LocationSelector } from "@/components/LocationSelector";
import { SessionCard } from "@/components/SessionCard";
import { ContinueWithInstaworkSheet } from "@/components/ContinueWithInstaworkSheet";
import { useGetSessions, getGetSessionsQueryKey, useGetSites } from "@/lib/api-client";
import type { SessionItem as Session } from "@/lib/api-client/generated/api.schemas";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertCircle, BadgeDollarSign, Check, Clock, Mic, ShieldCheck } from "lucide-react";
import { SiteLeafletMap } from "@/components/SiteLeafletMap";
import { trackEvent } from "@/lib/analytics";

const INITIAL_SESSION_COUNT = 6;

/**
 * Representative national total-pay figure (whole USD) shown in the hero
 * before a location resolves, or if geolocation fails. Single source of
 * truth — keep in sync with whatever number ads are running.
 */
const DEFAULT_NATIONAL_PAY_USD = 110;

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

const HOW_IT_WORKS_STEPS = [
  "Pick an available date and time near you.",
  "Complete the short sign-up form and reserve your session in the Instawork app.",
  "Visit the location, sit at a computer, and follow simple on-screen prompts.",
  "Your session payment is processed through Instawork.",
];

/** Trust reassurances shown after "What will I actually do?". */
const TRUST_POINTS = [
  "Sessions are staffed and paid the same way as your other Instawork shifts",
  "Covered under Instawork's standard worker protections",
  "In-app support available if you have questions before or during your session",
  "No recording or acting experience needed — you'll get simple on-screen prompts",
];

/** States where this opportunity is not currently offered (code → display name). */
const RESTRICTED_STATES: Record<string, string> = {
  TX: "Texas",
  WA: "Washington",
  IL: "Illinois",
};

/** Placeholder until the real help-center URL is available. */
const HELP_CENTER_URL = "https://help.instawork.com";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Do I need experience?",
    a: "No. Every task is guided, and a team member walks you through the session.",
  },
  {
    q: "What will I be recording?",
    a: "Short voice prompts — reading sentences, answering simple questions, or repeating phrases while wearing a headset.",
  },
  {
    // TODO — copy pending. Do not guess data usage or retention; needs
    // real answer from the research/privacy team.
    q: "How are my voice recordings used and stored?",
    a: "TODO — copy pending",
  },
  {
    q: "How and when do I get paid?",
    a: "We pass along your full session earnings. Payment is processed automatically through Instawork's weekly pay — funds land in your bank by end of day Wednesday for sessions completed that week.",
  },
  {
    q: "What happens after I select a session?",
    a: "You'll continue to Instawork to confirm your booking. You'll see the exact time, location, and pay before you commit.",
  },
];

export default function Landing() {
  const { site, setSite } = useSiteStorage();
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  // Incremented to open the location selector.
  const [pickerFocus, setPickerFocus] = useState(0);
  const sessionsRef = useRef<HTMLDivElement | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasCity = !!site;

  const { data, isLoading } = useGetSessions(
    { site: site?.key || "" },
    { query: { enabled: hasCity, queryKey: getGetSessionsQueryKey({ site: site?.key || "" }) } },
  );

  const sessions = useMemo(() => upcomingSorted(data?.sessions ?? []), [data?.sessions]);

  // Dev-only guard: two rows sharing date, time, AND location are a genuine
  // duplicate (data or rendering bug), unlike look-alikes that differ only by
  // venue. Surface them in the console rather than silently collapsing —
  // whether same-address/same-time rows are legit (e.g. parallel rooms) is a
  // data question, so we flag, not filter.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const seen = new Map<string, string>();
    for (const s of sessions) {
      const loc = s.neighborhoodLabel || s.fullAddress || "(no location)";
      const key = `${s.dateISO}|${s.time}|${loc}`;
      const prior = seen.get(key);
      if (prior) {
        console.warn(
          `[sessions] duplicate row — same date, time, and location for ids ${prior} and ${s.id}: ${key}`,
        );
      } else {
        seen.set(key, s.id);
      }
    }
  }, [sessions]);

  // Eligibility: derive the 2-letter state from the selected site's label
  // ("City, ST") and flag the restricted states so we can block proceeding.
  const restrictedStateName = useMemo(() => {
    const code = site?.label.split(",").pop()?.trim().toUpperCase();
    return code && RESTRICTED_STATES[code] ? RESTRICTED_STATES[code] : null;
  }, [site?.label]);

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

  // Headline/chip pay: one whole-dollar figure, never a range, never cents.
  // A spread under $5 is usually cents of variance and reads as a bug, so it
  // collapses to "about $80"; a real spread floors to "$79+". Per-session
  // figures in the sessions list keep full precision.
  const payText = payStats
    ? payStats.max - payStats.min < 5
      ? `about $${Math.round(payStats.max)}`
      : `$${Math.round(payStats.min)}+`
    : null;

  // The hero never shows $0, a spinner, or an empty state: it opens on the
  // national figure and swaps to the local number when data resolves.
  const heroPayText = payText ?? `about $${DEFAULT_NATIONAL_PAY_USD}`;

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
      if (restrictedStateName) {
        openPicker();
        return;
      }
      scrollToSessions();
    };
    window.addEventListener("iw:view-sessions", onViewSessions);
    return () => window.removeEventListener("iw:view-sessions", onViewSessions);
  }, [site, restrictedStateName]);

  // Reset per-city choices whenever the canonical site changes, no matter
  // where the change came from (picker, map popup, another tab).
  useEffect(() => {
    setSelectedSession(null);
    setShowAll(false);
  }, [site?.key]);

  const openPicker = () => setPickerFocus((n) => n + 1);

  const handleSeeSessions = () => {
    trackEvent("find_sessions_clicked", { selected_city: site?.label ?? null, ...utmProps() });
    if (!hasCity) {
      openPicker();
      return;
    }
    // Restricted state — don't proceed; the inline notice by the location
    // field explains why.
    if (restrictedStateName) {
      trackEvent("restricted_state_blocked", {
        selected_city: site?.label ?? null,
        restricted_state: restrictedStateName,
        ...utmProps(),
      });
      return;
    }
    trackEvent("available_sessions_viewed", { selected_city: site?.label ?? null, ...utmProps() });
    scrollToSessions();
  };

  // Picking a city updates the selection and resets choice.
  const handleSiteSelected = (key: string, label: string, origin?: SiteOrigin) => {
    setSite(key, label, origin);
    setSelectedSession(null);
    setShowAll(false);
    trackEvent("research_city_selected", { selected_city: label, ...utmProps() });
  };

  const handleBook = (session: Session) => {
    setSelectedSession(session);
    trackEvent("research_session_selected", {
      selected_city: site?.label ?? null,
      selected_session_id: session.id,
      session_date: session.dateISO || session.date,
      session_start_time: session.time,
      estimated_total_pay: session.payAmount,
      ...utmProps(),
    });
    trackEvent("book_cta_clicked", {
      selected_city: site?.label ?? null,
      selected_session_id: session.id,
      ...utmProps(),
    });
    setSheetOpen(true);
  };

  const visibleSessions = showAll ? sessions : sessions.slice(0, INITIAL_SESSION_COUNT);
  const hiddenCount = sessions.length - visibleSessions.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <main className="flex-1 overflow-y-auto w-full pb-16">
        {/* ============ HERO ============ */}
        <div className="bg-gradient-to-b from-[#F8FBFF] via-[#FAFBFD] to-white">
        <div className="max-w-[1200px] mx-auto px-5 md:px-12 pt-8 md:pt-12 pb-8 md:pb-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
          {/* Single full-width text column. No hero image ships until a real
              desk-setup asset exists (an empty placeholder reads worse than
              none). To restore a two-column layout later, wrap this column and
              an image column in `grid md:grid-cols-[1fr_minmax(0,44%)]` and
              drop the max-w below — the copy block is otherwise unchanged. */}
          <div className="max-w-[65ch]">
            <p className="text-[13px] font-bold uppercase tracking-wide text-[#23409A] mb-3">
              Paid voice recording
            </p>
            <h1 className="text-[34px] md:text-[40px] lg:text-[46px] leading-[1.08] font-extrabold tracking-[-0.03em] text-[#101828]">
              Earn <span className="whitespace-nowrap">{heroPayText}</span>
              <br />
              in one 3-hour session
            </h1>
            <p className="text-[17px] leading-[1.5] text-[#475467] mt-4">
              Sit at a computer and read short voice prompts. No experience needed.
            </p>

            {/* Two compact info pills: total pay + duration */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7DF] px-3 py-1.5 text-[14px] font-semibold text-[#7A5A12]">
                <BadgeDollarSign className="w-4 h-4 text-[#B9861F]" strokeWidth={2} />
                {heroPayText} estimated pay
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F2FF] px-3 py-1.5 text-[14px] font-semibold text-[#5D4FC7]">
                <Clock className="w-4 h-4" strokeWidth={2} />
                In person · About 3 hours
              </span>
            </div>

            {/* Legitimacy signal near the pay pill: this is payroll W-2 work. */}
            <div className="mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F2F4F7] px-2 py-1 text-[12px] font-medium text-[#475467]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#667085]" strokeWidth={2} />
                W-2 · paid through Instawork payroll.
              </span>
            </div>

            <div className="mt-6 max-w-[560px]">
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
              {restrictedStateName && (
                <p
                  role="alert"
                  className="mt-3 flex items-start gap-2 text-[14px] leading-[1.5] text-[#B42318]"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>
                    Sessions aren't currently available to residents of {restrictedStateName}.
                    Try a different location.
                  </span>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSeeSessions}
              className="mt-4 w-full max-w-[560px] h-[54px] rounded-[14px] bg-[#23409A] text-white text-[16px] font-semibold transition-[transform,background-color] duration-150 active:scale-[0.99] active:bg-[#1a3179] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23409A]/40"
            >
              View sessions near me
            </button>

            <p className="text-[14px] text-[#475467] mt-3">
              Exact time, location, and pay shown before booking.
            </p>
            <p className="text-[14px] text-[#475467] mt-1.5">
              Already an Instawork Pro?{" "}
              <button
                type="button"
                onClick={() => {
                  trackEvent("login_clicked", { source_page: "landing", ...utmProps() });
                  login();
                }}
                className="text-[#23409A] font-semibold underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23409A]/40"
              >
                Log in to book instantly
              </button>
            </p>
          </div>
        </div>
        </div>

        {/* ============ SESSIONS ============ */}
        <section
          id="sessions"
          ref={sessionsRef}
          className="scroll-mt-[var(--header-height)] bg-[#F8FBFF] py-12 md:py-16"
        >
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#101828]">
              {hasCity ? `Available sessions near ${site!.label}` : "Available sessions"}
            </h2>
            <p className="text-[16px] text-[#475467] mt-1.5">
              Choose a time and finish booking in Instawork.
              {hasCity && (
                <button
                  type="button"
                  onClick={openPicker}
                  className="text-[#23409A] underline underline-offset-2 font-medium ml-1.5"
                >
                  Change location
                </button>
              )}
            </p>

            <div className="mt-7">
              {!hasCity ? (
                <div className="py-8 text-center max-w-[480px] mx-auto">
                  <p className="text-[17px] font-semibold text-[#101828]">
                    Enter your city to see sessions near you.
                  </p>
                  <button
                    type="button"
                    onClick={openPicker}
                    className="mt-4 inline-flex items-center justify-center h-12 px-6 rounded-[14px] border border-[#23409A] text-[#23409A] font-semibold text-[15px] active:opacity-80"
                  >
                    Enter your city
                  </button>
                </div>
              ) : restrictedStateName ? (
                <div className="py-8 text-center max-w-[480px] mx-auto">
                  <p className="text-[17px] font-semibold text-[#101828]">
                    Sessions aren't currently available to residents of {restrictedStateName}.
                  </p>
                  <p className="text-[15px] text-[#475467] mt-1.5">
                    Choose a different location to see available sessions.
                  </p>
                  <button
                    type="button"
                    onClick={openPicker}
                    className="mt-4 inline-flex items-center justify-center h-12 px-6 rounded-[14px] border border-[#23409A] text-[#23409A] font-semibold text-[15px] active:opacity-80"
                  >
                    Change location
                  </button>
                </div>
              ) : isLoading ? (
                <div className="space-y-3.5 divide-y divide-[#e4e7ec] border-t border-b border-[#e4e7ec]">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-[52px] w-full bg-muted" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-8 text-center max-w-[480px] mx-auto">
                  <p className="text-[17px] font-semibold text-[#101828]">
                    No sessions are currently open near this location.
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={openPicker}
                      className="inline-flex items-center justify-center h-12 px-6 rounded-[14px] border border-[#23409A] text-[#23409A] font-semibold text-[15px] active:opacity-80"
                    >
                      Change location
                    </button>
                    {closestOpenMarket && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSiteSelected(closestOpenMarket.key, closestOpenMarket.label)
                        }
                        className="inline-flex items-center justify-center h-12 px-6 rounded-[14px] border border-[#23409A] text-[#23409A] font-semibold text-[15px] active:opacity-80"
                      >
                        View sessions in {closestOpenMarket.label}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-[#e4e7ec] border-t border-b border-[#e4e7ec]">
                    {visibleSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onBook={() => handleBook(session)}
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
                        className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-[14px] border border-[#d0d5dd] bg-white text-[#101828] font-semibold text-[15px] active:opacity-80"
                      >
                        View more sessions ({hiddenCount})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {hasCity && (
              <p className="text-[14px] text-[#475467] mt-6">
                Already booked or completed a session?{" "}
                <button
                  type="button"
                  onClick={() => setEligibilityOpen(true)}
                  className="text-[#23409A] underline underline-offset-2"
                >
                  Check remaining sessions
                </button>
              </p>
            )}
          </div>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section id="how-it-works" className="scroll-mt-[var(--header-height)] py-10 md:py-14">
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#101828]">
              How it works
            </h2>
            <ol className="mt-6 max-w-[640px] space-y-3">
              {HOW_IT_WORKS_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-[16px] leading-[1.5] text-[#101828]">
                  <span className="font-bold text-[#23409A] shrink-0" aria-hidden="true">
                    {i + 1}.
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============ WHAT WILL I ACTUALLY DO ============ */}
        <section className="bg-white border-t border-[#eef0f3] py-16 md:py-24">
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <div className="max-w-[720px]">
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-[12px] bg-[#F4F2FF] mb-4"
                aria-hidden="true"
              >
                <Mic className="w-5 h-5 text-[#8C7CFF]" strokeWidth={1.75} />
              </span>
              <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#101828]">
                What will I actually do?
              </h2>
              <p className="text-[16px] leading-[1.6] text-[#475467] mt-4">
                You'll sit at a computer in a research location and complete a series of
                short, guided voice tasks. You may read sentences, answer simple prompts,
                or repeat phrases while wearing a headset. A team member will guide you
                through the session.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "No acting or recording experience required",
                  "Equipment is provided",
                  "You will receive instructions at the location",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[16px] text-[#101828]">
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full bg-[#ECFDF3] flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <Check className="w-3.5 h-3.5 text-[#2E8A50]" strokeWidth={2.5} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ============ WE HAVE YOU COVERED ============ */}
        <section className="bg-white border-t border-[#eef0f3] py-16 md:py-24">
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <div className="max-w-[720px]">
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-[12px] bg-[#ECFDF3] mb-4"
                aria-hidden="true"
              >
                <ShieldCheck className="w-5 h-5 text-[#2E8A50]" strokeWidth={1.75} />
              </span>
              <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#101828]">
                We have you covered
              </h2>
              <ul className="mt-6 space-y-3">
                {TRUST_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[16px] text-[#101828]">
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full bg-[#ECFDF3] flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <Check className="w-3.5 h-3.5 text-[#2E8A50]" strokeWidth={2.5} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ============ EXPLORE OTHER LOCATIONS ============ */}
        <section id="locations" className="scroll-mt-[var(--header-height)] bg-[#F8FBFF] py-14 md:py-20">
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#101828]">
              Explore other locations
            </h2>
            <p className="text-[16px] text-[#475467] mt-1.5">
              Sessions run in cities across the country. Find one near you.
            </p>
            <div className="mt-6 rounded-[16px] overflow-hidden border border-[#e4e7ec]">
              <SiteLeafletMap />
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" className="scroll-mt-[var(--header-height)] bg-white py-16 md:py-24">
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <div className="max-w-[720px]">
              <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#101828]">
                Frequently asked questions
              </h2>
              <Accordion type="single" collapsible className="mt-4">
                {FAQ_ITEMS.map(({ q, a }) => (
                  <AccordionItem key={q} value={q}>
                    <AccordionTrigger className="text-left text-[16px] font-semibold text-[#101828]">
                      {q}
                    </AccordionTrigger>
                    <AccordionContent className="text-[15px] leading-[1.6] text-[#475467]">
                      {a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <p className="text-[15px] leading-[1.6] text-[#475467] mt-6">
                Still have questions? Check out more FAQs in our help center.{" "}
                <a
                  href={HELP_CENTER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#23409A] font-semibold underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23409A]/40"
                >
                  Read more
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Eligibility notice — intentionally low-emphasis */}
        <div className="max-w-[1200px] mx-auto px-5 md:px-12">
          <p className="text-[13px] text-gray-500 mt-10">
            This opportunity is not currently available to residents of Texas, Washington,
            or Illinois.
          </p>
        </div>
      </main>

      <EligibilityCheckDrawer
        hideTrigger
        open={eligibilityOpen}
        onOpenChange={setEligibilityOpen}
      />

      <ContinueWithInstaworkSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        bookUrl={selectedSession?.bookUrl}
        analyticsProps={{
          selected_city: site?.label ?? null,
          selected_session_id: selectedSession?.id ?? null,
          session_date: selectedSession?.dateISO || selectedSession?.date || null,
          session_start_time: selectedSession?.time ?? null,
          estimated_total_pay: selectedSession?.payAmount ?? null,
          source_page: "landing",
          ...utmProps(),
        }}
      />
    </div>
  );
}
