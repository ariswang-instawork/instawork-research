import { useEffect, useMemo, useRef, useState } from "react";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { LocationSelector } from "@/components/LocationSelector";
import { ResearchSummary } from "@/components/ResearchSummary";
import { DateGroup } from "@/components/DateGroup";
import { SessionOption } from "@/components/SessionOption";
import { StickyBookingBar } from "@/components/StickyBookingBar";
import { ContinueWithInstaworkSheet } from "@/components/ContinueWithInstaworkSheet";
import { useGetSessions, getGetSessionsQueryKey } from "@/lib/api-client";
import type { SessionItem as Session } from "@/lib/api-client/generated/api.schemas";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Mic, Wallet, BadgeDollarSign } from "lucide-react";
import { SiteLeafletMap } from "@/components/SiteLeafletMap";
import { login } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

const INITIAL_SESSION_COUNT = 8;

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

export default function Landing() {
  const { site, setSite } = useSiteStorage();
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  // Incremented to open the location selector.
  const [pickerFocus, setPickerFocus] = useState(0);
  // Inline sessions panel; restored across reloads and detail-page visits.
  const [sessionsOpen, setSessionsOpen] = useState(
    () => localStorage.getItem("iw_sessions_expanded") === "1",
  );
  const sessionsPanelRef = useRef<HTMLDivElement | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasCity = !!site;

  const { data, isLoading } = useGetSessions(
    { site: site?.key || "" },
    { query: { enabled: hasCity, queryKey: getGetSessionsQueryKey({ site: site?.key || "" }) } },
  );

  const sessions = useMemo(() => upcomingSorted(data?.sessions ?? []), [data?.sessions]);

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

  // Legacy entry points (map "View openings", menu "Find sessions").
  useEffect(() => {
    const onViewSessions = () => {
      if (!site) {
        setPickerFocus((n) => n + 1);
        return;
      }
      setSessionsOpen(true);
      requestAnimationFrame(() => {
        sessionsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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
    setSessionsOpen(true);
    localStorage.setItem("iw_sessions_expanded", "1");
    trackEvent("available_sessions_viewed", { selected_city: site?.label ?? null, ...utmProps() });
    requestAnimationFrame(() => {
      sessionsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Picking a city updates the selection, collapses the panel, resets choice.
  const handleSiteSelected = (key: string, label: string, origin?: SiteOrigin) => {
    setSite(key, label, origin);
    setSessionsOpen(false);
    setSelectedSession(null);
    setShowAll(false);
    localStorage.removeItem("iw_sessions_expanded");
    trackEvent("research_city_selected", { selected_city: label, ...utmProps() });
  };

  const handleSelectSession = (session: Session) => {
    setSelectedSession(session);
    trackEvent("research_session_selected", {
      selected_city: site?.label ?? null,
      selected_session_id: session.id,
      session_date: session.dateISO || session.date,
      session_start_time: session.time,
      estimated_total_pay: session.payAmount,
      ...utmProps(),
    });
  };

  // ---- Hero copy ----------------------------------------------------------
  const eyebrow = payText ? `${payText} PAID RESEARCH` : "PAID RESEARCH";
  const headline = payText
    ? `Get paid ${payText} for a 3-hour voice study`
    : "Get paid for a 3-hour voice study";

  // ---- Session grouping ---------------------------------------------------
  const visibleSessions = showAll ? sessions : sessions.slice(0, INITIAL_SESSION_COUNT);
  const hiddenCount = sessions.length - visibleSessions.length;
  const groups = useMemo(() => {
    const out: { label: string; items: Session[] }[] = [];
    for (const s of visibleSessions) {
      const last = out[out.length - 1];
      if (last && last.label === s.date) last.items.push(s);
      else out.push({ label: s.date, items: [s] });
    }
    return out;
  }, [visibleSessions]);

  const showStickyBar = hasCity && sessionsOpen && !!selectedSession;

  // Arrow-key navigation across the whole session list (radio-group model).
  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault();
    const list = visibleSessions;
    if (list.length === 0) return;
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const idx = selectedSession ? list.findIndex((s) => s.id === selectedSession.id) : -1;
    const next = list[(idx + dir + list.length) % list.length];
    setSelectedSession(next);
    document.getElementById(`session-option-${next.id}`)?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <main
        className={`flex-1 overflow-y-auto w-full ${showStickyBar ? "pb-[140px]" : "pb-16"}`}
      >
        <div className="max-w-[1120px] mx-auto px-5 md:px-12 pt-8 md:pt-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
          {/* Hero — copy left, illustration right on desktop */}
          <div className="grid md:grid-cols-2 md:items-center gap-8 md:gap-12">
            <div className="order-2 md:order-1 max-w-[560px]">
              <p className="text-[13px] font-bold uppercase tracking-wide text-[#1c387d] mb-3">
                {eyebrow}
              </p>
              <h1 className="text-[42px] md:text-[60px] leading-[1.08] font-extrabold tracking-[-0.03em] text-[#101828]">
                {headline}
              </h1>
              <p className="text-[17px] leading-[1.5] text-[#475467] mt-4">
                Complete simple, guided recording tasks at a nearby research location. No
                experience needed.
              </p>

              <div className="mt-5">
                {hasCity && isLoading ? (
                  <Skeleton className="h-5 w-72 bg-muted" />
                ) : (
                  <ResearchSummary payText={payText} />
                )}
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
                className="mt-4 w-full h-[54px] rounded-[14px] bg-[#1c387d] text-white text-[16px] font-semibold transition-[transform,background-color] duration-150 active:scale-[0.99] active:bg-[#16295e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c387d]/40"
              >
                View available sessions
              </button>

              <p className="text-[15px] text-[#475467] mt-4 text-center">
                Already have an Instawork account?{" "}
                <button
                  type="button"
                  onClick={() => login()}
                  className="text-[#1c387d] underline underline-offset-2 font-medium"
                >
                  Log in
                </button>
              </p>
            </div>

            <div className="order-1 md:order-2">
              <div className="rounded-2xl overflow-hidden">
                <img
                  src={`${import.meta.env.BASE_URL}hero-voice-recording.png`}
                  alt=""
                  loading="lazy"
                  className="w-full h-auto object-cover max-h-[280px] md:max-h-[460px]"
                />
              </div>
            </div>
          </div>

          {/* Session picker — revealed by "View available sessions" */}
          {hasCity && sessionsOpen && (
            <div
              ref={sessionsPanelRef}
              className="mt-12 md:mt-16 scroll-mt-20 max-w-[720px] mx-auto animate-in fade-in slide-in-from-bottom-3 duration-300"
            >
              <h2 className="text-[26px] leading-[1.15] font-bold tracking-tight text-[#101828]">
                Available sessions
              </h2>
              <p className="text-[15px] text-[#475467] mt-1.5">
                {site!.label}
                {payText ? ` · ${payText}` : ""} · 3 hours{" "}
                <button
                  type="button"
                  onClick={openPicker}
                  className="text-[#1c387d] underline underline-offset-2 font-medium ml-1"
                >
                  Change location
                </button>
              </p>

              <div className="mt-6 space-y-6">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-[56px] w-full rounded-[14px] bg-muted" />
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-base font-semibold text-[#101828]">
                      No sessions are currently available in {site!.label}.
                    </p>
                    <p className="text-base text-[#475467] mt-1">
                      Check another city or come back soon for new openings.
                    </p>
                    <button
                      type="button"
                      onClick={openPicker}
                      className="mt-4 inline-flex items-center justify-center min-h-[44px] px-6 rounded-[14px] border border-[#1c387d] text-[#1c387d] font-semibold text-base active:opacity-80"
                    >
                      Choose another city
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-6" onKeyDown={handleListKeyDown}>
                      {groups.map((group) => (
                        <DateGroup key={group.label} label={group.label}>
                          {group.items.map((session) => (
                            <SessionOption
                              key={session.id}
                              session={session}
                              payText={sessionPayText(session)}
                              selected={selectedSession?.id === session.id}
                              onSelect={() => handleSelectSession(session)}
                              tabIndex={
                                selectedSession
                                  ? selectedSession.id === session.id
                                    ? 0
                                    : -1
                                  : visibleSessions[0]?.id === session.id
                                    ? 0
                                    : -1
                              }
                            />
                          ))}
                        </DateGroup>
                      ))}
                    </div>
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAll(true);
                          trackEvent("see_more_sessions_clicked", {
                            selected_city: site?.label ?? null,
                            ...utmProps(),
                          });
                        }}
                        className="w-full min-h-[44px] text-[#1c387d] font-semibold text-[15px] underline underline-offset-2"
                      >
                        See more dates ({hiddenCount})
                      </button>
                    )}
                  </>
                )}
              </div>

              <p className="text-[13px] text-[#475467] mt-6">
                Already booked or completed a session?{" "}
                <button
                  type="button"
                  onClick={() => setEligibilityOpen(true)}
                  className="text-[#1c387d] underline underline-offset-2"
                >
                  Check remaining sessions
                </button>
              </p>
            </div>
          )}

          {/* Map card — only once a location has been selected */}
          {hasCity && (
            <div className="mt-12 md:mt-16 max-w-[720px] mx-auto rounded-2xl overflow-hidden border border-[hsl(var(--border))]">
              <SiteLeafletMap />
            </div>
          )}

          {/* Value section */}
          <div className="mt-16 md:mt-24 max-w-[960px] mx-auto" id="trust-section">
            <h2 className="text-[26px] leading-[1.15] font-bold tracking-tight text-[#101828] mb-6 md:mb-8">
              What to expect
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  icon: BadgeDollarSign,
                  title: "Earn money in one session",
                  body: "See the exact total pay before you book.",
                },
                {
                  icon: Sparkles,
                  title: "No experience needed",
                  body: "We guide you through every recording task.",
                },
                {
                  icon: Mic,
                  title: "Simple guided session",
                  body: "Sit at a computer and record short voice prompts.",
                },
                {
                  icon: Wallet,
                  title: "Paid through Instawork",
                  body: "Manage your session and receive secure payment through the Instawork app.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 bg-white rounded-[16px] border border-[#e4e7ec] p-5"
                >
                  <Icon className="w-5 h-5 text-[#1c387d] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div>
                    <p className="text-[15px] font-bold text-gray-900">{title}</p>
                    <p className="text-[15px] text-gray-600 mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Eligibility notice — intentionally low-emphasis, away from the CTA */}
          <p className="text-xs text-gray-500 mt-10 max-w-[960px] mx-auto">
            This opportunity is not currently available to residents of Texas, Washington, or
            Illinois.
          </p>
        </div>
      </main>

      {showStickyBar && (
        <StickyBookingBar
          session={selectedSession}
          payText={selectedSession ? sessionPayText(selectedSession) : null}
          onContinue={() => {
            if (!selectedSession) return;
            trackEvent("book_cta_clicked", {
              selected_city: site?.label ?? null,
              selected_session_id: selectedSession.id,
              ...utmProps(),
            });
            setSheetOpen(true);
          }}
        />
      )}

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
