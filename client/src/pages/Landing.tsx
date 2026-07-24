import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { LocationCombobox } from "@/components/LocationCombobox";
import { ContinueWithInstaworkSheet } from "@/components/ContinueWithInstaworkSheet";
import { useGetSessions, getGetSessionsQueryKey } from "@/lib/api-client";
import type { SessionItem as Session } from "@/lib/api-client/generated/api.schemas";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Mic,
  Wallet,
  MapPin,
  BadgeDollarSign,
  ChevronRight,
} from "lucide-react";
import { PrimaryCtaButton } from "@/components/PrimaryCtaButton";
import { SiteLeafletMap } from "@/components/SiteLeafletMap";
import { login } from "@/hooks/use-auth";
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

function SessionsList({
  sessions,
  isLoading,
  siteLabel,
  onChoose,
  onChooseAnotherCity,
}: {
  sessions: Session[];
  isLoading: boolean;
  siteLabel: string;
  onChoose: (session: Session) => void;
  onChooseAnotherCity: () => void;
}) {
  const [, setLocation] = useLocation();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between py-[18px] border-b border-[hsl(var(--border))] animate-pulse"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32 bg-muted" />
              <Skeleton className="h-4 w-24 bg-muted" />
            </div>
            <Skeleton className="h-5 w-14 bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-base font-semibold text-[#101828]">
          No sessions are currently available in {siteLabel}.
        </p>
        <p className="text-base text-[#475467] mt-1">
          Check another city or come back soon for new openings.
        </p>
        <button
          type="button"
          onClick={onChooseAnotherCity}
          className="mt-4 inline-flex items-center justify-center min-h-[44px] px-6 rounded-xl border border-[#1c387d] text-[#1c387d] font-semibold text-base active:opacity-80"
        >
          Choose another city
        </button>
      </div>
    );
  }

  const visible = showAll ? sessions : sessions.slice(0, INITIAL_SESSION_COUNT);
  const hiddenCount = sessions.length - visible.length;

  return (
    <div>
      {visible.map((session) => {
        const pay = parseFloat(session.payAmount);
        const payText = Number.isFinite(pay) ? `Earn ${formatPay(pay)}` : session.payLabel;
        const hours = session.billableHours != null ? `${session.billableHours} hours` : "3 hours";
        return (
          <div
            key={session.id}
            className="py-[18px] border-b border-[hsl(var(--border))]"
          >
            <div className="flex items-start justify-between gap-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setLocation(`/sessions/${session.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLocation(`/sessions/${session.id}`);
                  }
                }}
                className="flex-1 min-w-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={`View details for ${session.date}, ${session.time}`}
              >
                <div className="font-bold text-[16px] mb-0.5">{session.date}</div>
                <div className="text-muted-foreground text-[13px]">
                  {session.time} · {hours}
                </div>
                <div className="font-bold text-[15px] mt-1.5">{payText}</div>
              </div>
              <button
                type="button"
                onClick={() => onChoose(session)}
                className="shrink-0 min-h-[44px] px-4 rounded-xl bg-[#1c387d] text-white text-[14px] font-semibold active:bg-[#16295e] transition-colors self-center"
              >
                Choose this session
              </button>
            </div>
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setShowAll(true);
            trackEvent("see_more_sessions_clicked", { selected_city: siteLabel, ...utmProps() });
          }}
          className="w-full min-h-[44px] mt-2 text-[#1c387d] font-semibold text-base underline underline-offset-2"
        >
          See more dates ({hiddenCount})
        </button>
      )}
    </div>
  );
}

export default function Landing() {
  const { site, setSite } = useSiteStorage();
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  // Incremented to focus the inline location field and open its dropdown.
  const [pickerFocus, setPickerFocus] = useState(0);
  // Inline sessions panel; restored across reloads and detail-page visits.
  const [sessionsOpen, setSessionsOpen] = useState(
    () => localStorage.getItem("iw_sessions_expanded") === "1",
  );
  const sessionsPanelRef = useRef<HTMLDivElement | null>(null);
  // "Continue with Instawork" sheet for a chosen session.
  const [chosenSession, setChosenSession] = useState<Session | null>(null);

  const hasCity = !!site;

  // Sessions for the selected city power both the dynamic hero pay and the list.
  const { data, isLoading } = useGetSessions(
    { site: site?.key || "" },
    { query: { enabled: hasCity, queryKey: getGetSessionsQueryKey({ site: site?.key || "" }) } },
  );

  const sessions = useMemo(
    () => upcomingSorted(data?.sessions ?? []),
    [data?.sessions],
  );

  // Dynamic pay: min/max of total estimated pay across available sessions.
  const payStats = useMemo(() => {
    const amounts = sessions
      .map((s) => parseFloat(s.payAmount))
      .filter((n) => Number.isFinite(n));
    if (amounts.length === 0) return null;
    return { min: Math.min(...amounts), max: Math.max(...amounts) };
  }, [sessions]);

  useEffect(() => {
    trackEvent("research_landing_viewed", { selected_city: site?.label ?? null, ...utmProps() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Legacy entry points (map "View openings", menu "Find sessions") ask the
  // landing page to reveal the inline sessions panel via this event.
  useEffect(() => {
    const onViewSessions = () => {
      // Without a city there is no panel to reveal — prompt for one instead.
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

  const openPicker = () => {
    setPickerFocus((n) => n + 1);
  };

  // Primary CTA. Without a city it focuses the location picker; with a city
  // it reveals the inline sessions panel.
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

  // Picking a city only updates the selection — never navigates, and
  // collapses a previously revealed sessions panel.
  const handleSiteSelected = (key: string, label: string, origin?: SiteOrigin) => {
    setSite(key, label, origin);
    setSessionsOpen(false);
    localStorage.removeItem("iw_sessions_expanded");
    trackEvent("research_city_selected", { selected_city: label, ...utmProps() });
  };

  const handleChooseSession = (session: Session) => {
    trackEvent("research_session_selected", {
      selected_city: site?.label ?? null,
      selected_session_id: session.id,
      session_date: session.dateISO || session.date,
      session_start_time: session.time,
      estimated_total_pay: session.payAmount,
      ...utmProps(),
    });
    setChosenSession(session);
  };

  // ---- Dynamic hero copy -------------------------------------------------
  const singlePay = payStats && payStats.min === payStats.max ? payStats.min : null;
  let headline = "Get paid to record your voice";
  let supporting: React.ReactNode;
  let valueSummary: string | null = null;

  if (!hasCity) {
    supporting = (
      <>
        Earn <span className="font-bold text-[#101828] text-2xl">$66–$111</span> for a
        simple, guided 3-hour session.
      </>
    );
  } else if (isLoading || !payStats) {
    supporting = isLoading ? (
      <Skeleton className="h-6 w-64 bg-muted inline-block align-middle" />
    ) : (
      <>Select a session to see exact pay.</>
    );
    valueSummary = payStats ? null : isLoading ? null : "3 hours · No experience needed · Paid through Instawork";
  } else if (singlePay != null) {
    headline = `Get paid ${formatPay(singlePay)} to record your voice`;
    supporting = (
      <>
        Join a simple, guided 3-hour research session in {site!.label}. No experience needed.
      </>
    );
    valueSummary = `${formatPay(singlePay)} total · 3 hours · Paid through Instawork`;
  } else {
    supporting = (
      <>
        Earn{" "}
        <span className="font-bold text-[#101828] text-2xl">
          {formatPay(payStats.min)}–{formatPay(payStats.max)}
        </span>{" "}
        for a simple, guided 3-hour research session in {site!.label}.
      </>
    );
    valueSummary = "3 hours · No experience needed · Paid through Instawork";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <main className="flex-1 overflow-y-auto px-[clamp(24px,6vw,72px)] pt-[clamp(28px,5vw,56px)] pb-[calc(clamp(64px,10vw,112px)+env(safe-area-inset-bottom))] max-w-md mx-auto w-full [container-type:inline-size] animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div>
          {/* Hero illustration */}
          <div className="rounded-2xl overflow-hidden mb-[clamp(28px,5vw,48px)]">
            <img
              src={`${import.meta.env.BASE_URL}hero-voice-recording.png`}
              alt=""
              loading="lazy"
              className="w-full h-auto object-cover md:max-h-[420px]"
            />
          </div>

          {/* Eyebrow / location row */}
          {hasCity ? (
            <div className="flex items-center gap-2 mb-[clamp(20px,4vw,32px)]">
              <MapPin className="w-5 h-5 text-[#101828] shrink-0" strokeWidth={2} />
              <span className="text-base font-bold text-[#101828]">{site!.label}</span>
              <button
                type="button"
                onClick={openPicker}
                className="text-base text-[#1c387d] underline underline-offset-2"
              >
                Change city
              </button>
            </div>
          ) : (
            <p className="text-sm font-bold uppercase tracking-wide text-[#1c387d] mb-[clamp(16px,3vw,24px)]">
              Instawork Research
            </p>
          )}

          {/* Hero */}
          <h2 className="text-[clamp(36px,9cqw,56px)] leading-[1.08] font-extrabold tracking-[-0.03em] text-[#101828] mb-[clamp(24px,4vw,40px)]">
            {headline}
          </h2>
          <p className="text-xl leading-[1.4] text-[#475467]">{supporting}</p>
          {!hasCity && (
            <p className="text-sm text-[#667085] mt-1.5">Pay varies by location and session.</p>
          )}
          {valueSummary && (
            <p className="text-base font-semibold text-[#101828] mt-3">{valueSummary}</p>
          )}
          <p className="text-base leading-[1.5] text-[#475467] mt-2 mb-[clamp(24px,4vw,40px)]">
            {hasCity
              ? "Visit a nearby location and complete simple, guided recording tasks."
              : "Choose your city to see exact pay and available times near you."}
          </p>

          {/* Location search */}
          <div className="space-y-[clamp(16px,3vw,24px)]">
            <LocationCombobox
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

          {/* Primary CTA */}
          <div className="mt-[clamp(16px,3vw,24px)]">
            <PrimaryCtaButton
              onClick={handleSeeSessions}
              className="rounded-2xl h-auto px-7 py-[18px] bg-[#1c387d] text-white font-bold hover:bg-[#1c387d]/90 transition-[transform,background-color] duration-150 active:scale-[0.98] active:bg-[#16295e]"
            >
              {hasCity ? "View available sessions" : "Find sessions"}
            </PrimaryCtaButton>
          </div>

          <p className="text-base text-[#475467] mt-[clamp(16px,3vw,24px)] text-center">
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

        {/* Inline sessions panel — revealed by "View available sessions" */}
        {hasCity && sessionsOpen && (
          <div
            ref={sessionsPanelRef}
            className="mt-[clamp(32px,6vw,48px)] scroll-mt-20 animate-in fade-in slide-in-from-bottom-3 duration-300"
          >
            <h2 className="text-[24px] leading-[1.15] font-bold tracking-tight text-[#101828] mb-4">
              Available sessions in {site!.label}
            </h2>
            <SessionsList
              sessions={sessions}
              isLoading={isLoading}
              siteLabel={site!.label}
              onChoose={handleChooseSession}
              onChooseAnotherCity={openPicker}
            />
            <p className="text-[13px] text-[#475467] mt-5">
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
          <div className="my-[clamp(32px,6vw,48px)] rounded-2xl overflow-hidden border border-[hsl(var(--border))]">
            <SiteLeafletMap />
          </div>
        )}

        {/* Value section */}
        <div className="mt-[clamp(64px,10vw,96px)]" id="trust-section">
          <h2 className="text-[28px] leading-[1.15] font-bold tracking-tight text-[#101828] mb-[clamp(32px,5vw,48px)]">
            What to expect
          </h2>
          <div className="space-y-[clamp(16px,3vw,24px)]">
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-[clamp(24px,4vw,32px)]">
              <BadgeDollarSign className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">Earn money in one session</p>
                <p className="text-base text-gray-600 mt-0.5">See the exact total pay before you book.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-[clamp(24px,4vw,32px)]">
              <Sparkles className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">No experience needed</p>
                <p className="text-base text-gray-600 mt-0.5">We guide you through every recording task.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-[clamp(24px,4vw,32px)]">
              <Mic className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">Simple guided session</p>
                <p className="text-base text-gray-600 mt-0.5">Sit at a computer and record short voice prompts.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-[clamp(24px,4vw,32px)]">
              <Wallet className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">Paid through Instawork</p>
                <p className="text-base text-gray-600 mt-0.5">Manage your session and receive secure payment through the Instawork app.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Eligibility notice — intentionally low-emphasis, away from the CTA */}
        <p className="text-xs text-gray-500 mt-[clamp(32px,5vw,48px)]">
          This opportunity is not currently available to residents of Texas, Washington, or Illinois.
        </p>
      </main>

      <EligibilityCheckDrawer
        hideTrigger
        open={eligibilityOpen}
        onOpenChange={setEligibilityOpen}
      />

      <ContinueWithInstaworkSheet
        open={!!chosenSession}
        onOpenChange={(open) => {
          if (!open) setChosenSession(null);
        }}
        bookUrl={chosenSession?.bookUrl}
        analyticsProps={{
          selected_city: site?.label ?? null,
          selected_session_id: chosenSession?.id ?? null,
          session_date: chosenSession?.dateISO || chosenSession?.date || null,
          session_start_time: chosenSession?.time ?? null,
          estimated_total_pay: chosenSession?.payAmount ?? null,
          source_page: "landing",
          ...utmProps(),
        }}
      />
    </div>
  );
}
