import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { LocationCombobox } from "@/components/LocationCombobox";
import { useGetSessions } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_SITE } from "@/lib/constants";
import {
  Sparkles,
  Mic,
  Wallet,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { PrimaryCtaButton } from "@/components/PrimaryCtaButton";
import { SiteLeafletMap } from "@/components/SiteLeafletMap";
import { login } from "@/hooks/use-auth";

function SessionsList({ siteKey, siteLabel }: { siteKey: string; siteLabel: string }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetSessions({ site: siteKey });

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

  if (!data?.sessions || data.sessions.length === 0) {
    return (
      <p className="text-base text-[#475467] py-4">
        No open sessions in {siteLabel} right now. Try another city.
      </p>
    );
  }

  return (
    <div>
      {data.sessions.map((session) => (
        <div
          key={session.id}
          role="button"
          tabIndex={0}
          onClick={() => setLocation(`/sessions/${session.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setLocation(`/sessions/${session.id}`);
            }
          }}
          className="flex items-center justify-between py-[18px] min-h-[44px] border-b border-[hsl(var(--border))] cursor-pointer hover:bg-muted/40 active:opacity-60 transition-[background-color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
        >
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[16px] mb-0.5">{session.date}</div>
            <div className="text-muted-foreground text-[13px]">{session.time}</div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="font-bold text-[15px]">{session.payLabel || "$72"}</span>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const { site, setSite } = useSiteStorage();
  const [, setLocation] = useLocation();
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  // Incremented to focus the inline location field and open its dropdown.
  const [pickerFocus, setPickerFocus] = useState(0);
  // Inline sessions panel; restored across reloads and detail-page visits.
  const [sessionsOpen, setSessionsOpen] = useState(
    () => localStorage.getItem("iw_sessions_expanded") === "1",
  );
  const sessionsPanelRef = useRef<HTMLDivElement | null>(null);

  // Legacy entry points (map "View openings", menu "Find sessions") ask the
  // landing page to reveal the inline sessions panel via this event.
  useEffect(() => {
    const onViewSessions = () => {
      setSessionsOpen(true);
      requestAnimationFrame(() => {
        sessionsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    window.addEventListener("iw:view-sessions", onViewSessions);
    return () => window.removeEventListener("iw:view-sessions", onViewSessions);
  }, []);

  const displaySite = site || DEFAULT_SITE;

  // "View sessions": reveal the inline panel for the displayed city
  // (falls back to the default site when none was explicitly picked).
  const handleSeeSessions = () => {
    if (!site) setSite(displaySite.key, displaySite.label);
    setSessionsOpen(true);
    localStorage.setItem("iw_sessions_expanded", "1");
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
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <main className="flex-1 overflow-y-auto px-[clamp(24px,6vw,72px)] pt-[clamp(32px,6vw,64px)] pb-[calc(clamp(64px,10vw,112px)+env(safe-area-inset-bottom))] max-w-md mx-auto w-full [container-type:inline-size] animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* Hero: illustration above the copy on mobile, two columns on md+ */}
        <div>
          <div className="rounded-2xl overflow-hidden mb-[clamp(28px,5vw,48px)]">
            <img
              src={`${import.meta.env.BASE_URL}hero-voice-recording.png`}
              alt=""
              loading="lazy"
              className="w-full h-auto object-cover md:max-h-[420px]"
            />
          </div>

          <div>
        {/* Location row */}
        <div className="flex items-center gap-2 mb-[clamp(20px,4vw,32px)]">
          <MapPin className="w-5 h-5 text-[#101828] shrink-0" strokeWidth={2} />
          <span className="text-base font-bold text-[#101828]">{displaySite.label}</span>
          <button
            type="button"
            onClick={() => setPickerFocus((n) => n + 1)}
            className="text-base text-[#1c387d] underline underline-offset-2"
          >
            Change city
          </button>
        </div>

        {/* Hero */}
        <h2 className="text-[clamp(36px,9cqw,56px)] leading-[1.08] font-extrabold tracking-[-0.03em] text-[#101828] mb-[clamp(28px,5vw,48px)]">
          Get paid to record your voice.
        </h2>
        <p className="text-xl leading-[1.4] text-[#475467]">
          Earn <span className="font-bold text-[#101828] text-2xl">$66–$111</span> for a
          3-hour session.
        </p>
        <p className="text-base leading-[1.5] text-[#475467] mt-2 mb-[clamp(28px,5vw,48px)]">
          Visit a nearby location and complete simple, guided recording tasks.
        </p>

        {/* Location search + browse */}
        <div className="space-y-[clamp(16px,3vw,24px)]">
          <LocationCombobox
            focusSignal={pickerFocus}
            onSiteSelected={handleSiteSelected}
          />

        </div>

        {/* Primary CTA */}
        <div className="mt-[clamp(16px,3vw,24px)]">
          <PrimaryCtaButton
            onClick={handleSeeSessions}
            className="rounded-2xl h-auto px-7 py-[18px] bg-[#1c387d] text-white font-bold hover:bg-[#1c387d]/90 transition-[transform,background-color] duration-150 active:scale-[0.98] active:bg-[#16295e]"
          >
            View sessions
          </PrimaryCtaButton>
        </div>

        <p className="text-base text-[#475467] mt-[clamp(16px,3vw,24px)] text-center">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => login()}
            className="text-[#1c387d] underline underline-offset-2 font-medium"
          >
            Log in
          </button>
        </p>

        <p className="text-xs text-gray-500 mt-[clamp(16px,3vw,24px)]">
          Not currently available to residents of Texas, Washington, or Illinois.
        </p>
          </div>
        </div>

        {/* Inline sessions panel — revealed by "View sessions" */}
        {sessionsOpen && (
          <div
            ref={sessionsPanelRef}
            className="mt-[clamp(32px,6vw,48px)] scroll-mt-20 animate-in fade-in slide-in-from-bottom-3 duration-300"
          >
            <h2 className="text-[24px] leading-[1.15] font-bold tracking-tight text-[#101828]">
              Available sessions
            </h2>
            <p className="text-base text-[#475467] mt-1 mb-4">{displaySite.label}</p>
            <SessionsList siteKey={displaySite.key} siteLabel={displaySite.label} />
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

        {/* Map card */}
        <div className="my-[clamp(32px,6vw,48px)] rounded-2xl overflow-hidden border border-[hsl(var(--border))]">
          <SiteLeafletMap />
        </div>

        {/* Trust section */}
        <div className="mt-[clamp(80px,12vw,112px)]" id="trust-section">
          <h2 className="text-[28px] leading-[1.15] font-bold tracking-tight text-[#101828] mb-[clamp(32px,5vw,48px)]">
            Why people choose Instawork
          </h2>
          <div className="space-y-[clamp(16px,3vw,24px)]">
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-[clamp(24px,4vw,32px)]">
              <Sparkles className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">No experience needed</p>
                <p className="text-base text-gray-600 mt-0.5">We'll guide you through every step.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-[clamp(24px,4vw,32px)]">
              <Mic className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">Simple guided session</p>
                <p className="text-base text-gray-600 mt-0.5">Complete simple voice recording tasks.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-[clamp(24px,4vw,32px)]">
              <Wallet className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">Paid through Instawork</p>
                <p className="text-base text-gray-600 mt-0.5">Secure payment after your session.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <EligibilityCheckDrawer
        hideTrigger
        open={eligibilityOpen}
        onOpenChange={setEligibilityOpen}
      />

    </div>
  );
}
