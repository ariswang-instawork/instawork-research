import { useState } from "react";
import { useLocation } from "wouter";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { LocationDrawer, EligibilityCheckDrawer } from "@/components/Drawers";
import { DEFAULT_SITE } from "@/lib/constants";
import {
  Sparkles,
  Mic,
  Wallet,
  MapPin,
  Search,
  Send,
  ChevronRight,
} from "lucide-react";
import { PrimaryCtaButton } from "@/components/PrimaryCtaButton";

export default function Landing() {
  const { site, setSite } = useSiteStorage();
  const [, setLocation] = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [eligibilityOpen, setEligibilityOpen] = useState(false);

  const displaySite = site || DEFAULT_SITE;

  // Always open the location modal first — never navigate straight to
  // sessions, even when a previous location is stored.
  const handleSeeSessions = () => {
    setIsDrawerOpen(true);
  };

  const handleBrowseNearby = () => {
    if (!site) setSite(DEFAULT_SITE.key, DEFAULT_SITE.label);
    setLocation("/sessions");
  };

  const handleSiteSelected = (key: string, label: string, origin?: SiteOrigin) => {
    setSite(key, label, origin);
    setIsDrawerOpen(false);
    setLocation("/sessions");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <main className="flex-1 overflow-y-auto px-6 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-md mx-auto w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* Location row */}
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="w-5 h-5 text-gray-900 shrink-0" strokeWidth={2} />
          <span className="text-base font-bold text-gray-900">{displaySite.label}</span>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="text-base text-primary underline underline-offset-2"
          >
            Change city
          </button>
        </div>

        {/* Hero */}
        <h2 className="text-[26px] leading-[1.12] font-bold tracking-tight text-gray-900 mb-4">
          Get paid to record your voice.
        </h2>
        <p className="text-base text-gray-900 mb-6">
          Earn <span className="font-bold text-primary">$66–$111</span> for a 3-hour
          session. Visit a nearby location and complete simple voice recording tasks.
        </p>

        {/* Two search cards */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="w-full flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-white px-4 py-4 text-left"
          >
            <MapPin className="w-5 h-5 text-primary shrink-0" strokeWidth={2} />
            <span className="flex-1 text-base text-gray-600">Choose a city or ZIP code</span>
            <Send className="w-5 h-5 text-primary shrink-0" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={handleBrowseNearby}
            className="w-full flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-white px-4 py-4 text-left"
          >
            <Search className="w-5 h-5 text-primary shrink-0" strokeWidth={2} />
            <span className="flex-1 text-base text-gray-900">Browse nearby sessions</span>
            <ChevronRight className="w-5 h-5 text-primary shrink-0" strokeWidth={2} />
          </button>
        </div>

        {/* Primary CTA */}
        <div className="mt-5">
          <PrimaryCtaButton
            onClick={handleSeeSessions}
            className="rounded-2xl bg-white text-[#246BFD] border border-[hsl(var(--border))] hover:bg-white/90"
          >
            See sessions
          </PrimaryCtaButton>
        </div>

        <button
          type="button"
          onClick={() => setEligibilityOpen(true)}
          className="block mx-auto mt-4 text-base text-gray-900 underline underline-offset-2"
        >
          Log in to check your remaining sessions
        </button>

        <p className="text-xs text-center text-gray-500 mt-3">
          Not currently available to residents of Texas, Washington, or Illinois.
        </p>

        {/* Trust section */}
        <div className="mt-10">
          <h2 className="text-[26px] leading-[1.12] font-bold tracking-tight text-gray-900 mb-6">
            Why people choose Instawork Research
          </h2>
          <div className="space-y-7">
            <div className="flex items-start gap-4">
              <Sparkles className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">No experience needed</p>
                <p className="text-base text-gray-600 mt-0.5">We'll guide you through every step.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Mic className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">Simple guided session</p>
                <p className="text-base text-gray-600 mt-0.5">Complete simple voice recording tasks.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Wallet className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">Paid through Instawork</p>
                <p className="text-base text-gray-600 mt-0.5">Secure payment after your session.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <LocationDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onSiteSelected={handleSiteSelected}
      />

      <EligibilityCheckDrawer
        hideTrigger
        open={eligibilityOpen}
        onOpenChange={setEligibilityOpen}
      />
    </div>
  );
}
