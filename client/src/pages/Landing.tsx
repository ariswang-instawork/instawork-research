import { useEffect, useMemo, useRef, useState } from "react";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
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
import { BadgeDollarSign, Check, Clock, Mic } from "lucide-react";
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

const HOW_IT_WORKS_STEPS = [
  {
    title: "Pick a session",
    body: "Choose an available date and time near you.",
  },
  {
    title: "Book in Instawork",
    body: "Complete the short sign-up form and reserve your session in the Instawork app.",
  },
  {
    title: "Record your voice",
    body: "Visit the location, sit at a computer, and follow simple on-screen prompts.",
  },
  {
    title: "Get paid",
    body: "Your session payment is processed through Instawork.",
  },
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Do I need experience?",
    a: "No. Every task is guided, and a team member walks you through the session.",
  },
  {
    q: "Is this remote or in person?",
    a: "In person. You'll visit a nearby location and complete the session on-site.",
  },
  {
    q: "What will I be recording?",
    a: "Short voice prompts — reading sentences, answering simple questions, or repeating phrases while wearing a headset.",
  },
  {
    q: "How will I get paid?",
    a: "Your payment is processed through the Instawork app after your session.",
  },
  {
    q: "What should I bring?",
    a: "A valid photo ID. Everything else, including equipment, is provided at the location.",
  },
  {
    q: "Can I complete more than one session?",
    a: "You may be eligible to complete multiple sessions. The number of sessions available to you depends on the location and project requirements. Log in to Instawork to see the sessions you're eligible to book.",
  },
  {
    q: "Where do I finish signing up?",
    a: "In the Instawork app. After you pick a session, you'll log in or create an account there to complete booking.",
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

  const sessionPayText = (s: Session) => {
    const n = parseFloat(s.payAmount);
    return Number.isFinite(n) ? formatPay(n) : s.payLabel || "";
  };

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

  // ---- Hero copy ----------------------------------------------------------
  // The pay amount is highlighted in coral for editorial emphasis.
  const headlinePay = singlePay != null ? formatPay(singlePay) : payText ?? "money";

  const visibleSessions = showAll ? sessions : sessions.slice(0, INITIAL_SESSION_COUNT);
  const hiddenCount = sessions.length - visibleSessions.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <main className="flex-1 overflow-y-auto w-full pb-16">
        {/* ============ HERO ============ */}
        <div className="bg-gradient-to-b from-[#F8FBFF] via-[#FAFBFD] to-white">
        <div className="max-w-[1200px] mx-auto px-5 md:px-12 pt-8 md:pt-14 pb-2 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="grid md:grid-cols-[1fr_minmax(0,460px)] md:items-center gap-8 md:gap-12">
            <div className="max-w-[560px]">
              <p className="text-[13px] font-bold uppercase tracking-wide text-[#23409A] mb-3">
                Paid voice recording
              </p>
              <h1 className="text-[34px] md:text-[48px] leading-[1.08] font-extrabold tracking-[-0.03em] text-[#101828]">
                Earn <span className="text-[#F26B63]">{headlinePay}</span> in one 3-hour
                session
              </h1>
              <p className="text-[17px] leading-[1.5] text-[#475467] mt-4">
                Read short voice prompts at a nearby location. No experience needed.
              </p>

              {/* Compact benefit badges */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7DF] px-3 py-1.5 text-[14px] font-semibold text-[#7A5A12]">
                  <BadgeDollarSign className="w-4 h-4 text-[#B9861F]" strokeWidth={2} />
                  {hasCity && isLoading ? (
                    <Skeleton className="h-4 w-20 bg-muted inline-block" />
                  ) : (
                    <>{payText ?? "Competitive"} estimated pay</>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F8FBFF] border border-[#dbe4f5] px-3 py-1.5 text-[14px] font-semibold text-[#23409A]">
                  <Clock className="w-4 h-4" strokeWidth={2} />
                  In-person · About 3 hours
                </span>
              </div>

              {/* Mobile image sits between details and location selector */}
              <div className="mt-6 md:hidden rounded-[16px] overflow-hidden bg-[#EAF6EE] p-2">
                <img
                  src={`${import.meta.env.BASE_URL}hero-voice-recording.png`}
                  alt="A participant wearing headphones records voice prompts at a computer"
                  width={1024}
                  height={683}
                  className="w-full h-auto object-cover max-h-[260px]"
                />
              </div>

              <div className="mt-6">
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
                className="mt-4 w-full h-[54px] rounded-[14px] bg-[#23409A] text-white text-[16px] font-semibold transition-[transform,background-color] duration-150 active:scale-[0.99] active:bg-[#1a3179] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23409A]/40"
              >
                View sessions near me
              </button>

              <p className="text-[14px] text-[#475467] mt-3 text-center">
                Exact time, location, and pay shown before booking.
              </p>
            </div>

            <div className="hidden md:block">
              <div className="rounded-[18px] overflow-hidden bg-[#EAF6EE] p-3">
                <img
                  src={`${import.meta.env.BASE_URL}hero-voice-recording.png`}
                  alt="A participant wearing headphones records voice prompts at a computer"
                  width={1024}
                  height={683}
                  className="w-full h-auto object-cover max-h-[440px]"
                />
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* ============ SESSIONS ============ */}
        <section
          id="sessions"
          ref={sessionsRef}
          className="scroll-mt-20 mt-12 md:mt-16 bg-[#F8FBFF] py-12 md:py-16"
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
                    className="mt-4 inline-flex items-center justify-center h-12 px-6 rounded-[14px] bg-[#23409A] text-white font-semibold text-[15px] active:opacity-90"
                  >
                    Enter your city
                  </button>
                </div>
              ) : isLoading ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-[190px] w-full rounded-[16px] bg-muted" />
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
                        className="inline-flex items-center justify-center h-12 px-6 rounded-[14px] bg-[#23409A] text-white font-semibold text-[15px] active:opacity-90"
                      >
                        View sessions in {closestOpenMarket.label}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    {visibleSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        payText={sessionPayText(session)}
                        onBook={() => handleBook(session)}
                      />
                    ))}
                  </div>
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
        <section id="how-it-works" className="scroll-mt-20 py-14 md:py-20">
          <div className="max-w-[1200px] mx-auto px-5 md:px-12">
            <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-bold tracking-tight text-[#101828]">
              Easy from start to finish
            </h2>
            <ol className="mt-8 grid md:grid-cols-4 gap-8 md:gap-6">
              {HOW_IT_WORKS_STEPS.map((step, i) => (
                <li key={step.title} className="flex md:flex-col gap-4">
                  <span
                    className="shrink-0 w-9 h-9 rounded-full bg-[#23409A] text-white text-[15px] font-bold flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[17px] font-bold text-[#101828]">{step.title}</p>
                    <p className="text-[15px] leading-[1.5] text-[#475467] mt-1">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============ WHAT WILL I ACTUALLY DO ============ */}
        <section className="bg-[#FAFBFD] py-14 md:py-20">
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

        {/* ============ EXPLORE OTHER LOCATIONS ============ */}
        <section className="py-14 md:py-20">
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
        <section id="faq" className="scroll-mt-20 bg-[#F8FBFF] py-14 md:py-20">
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
