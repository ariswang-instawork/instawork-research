import { useState } from "react";
import { useLocation } from "wouter";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { LocationCombobox } from "@/components/LocationCombobox";
import { DEFAULT_SITE } from "@/lib/constants";
import {
  Sparkles,
  Mic,
  Wallet,
  MapPin,
  Search,
  ChevronRight,
} from "lucide-react";
import { PrimaryCtaButton } from "@/components/PrimaryCtaButton";

export default function Landing() {
  const { site, setSite } = useSiteStorage();
  const [, setLocation] = useLocation();
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  // Incremented to focus the inline location field and open its dropdown.
  const [pickerFocus, setPickerFocus] = useState(0);

  const displaySite = site || DEFAULT_SITE;

  // Always route users through the location picker first — never navigate
  // straight to sessions, even when a previous location is stored.
  const handleSeeSessions = () => {
    setPickerFocus((n) => n + 1);
  };

  const handleBrowseNearby = () => {
    if (!site) setSite(DEFAULT_SITE.key, DEFAULT_SITE.label);
    setLocation("/sessions");
  };

  const handleSiteSelected = (key: string, label: string, origin?: SiteOrigin) => {
    setSite(key, label, origin);
    setLocation("/sessions");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <main className="flex-1 overflow-y-auto px-5 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-md mx-auto w-full [container-type:inline-size] animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* Location row */}
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="w-5 h-5 text-[#101828] shrink-0" strokeWidth={2} />
          <span className="text-base font-bold text-[#101828]">{displaySite.label}</span>
          <button
            type="button"
            onClick={() => setPickerFocus((n) => n + 1)}
            className="text-base text-[#246BFD] underline underline-offset-2"
          >
            Change city
          </button>
        </div>

        {/* Hero */}
        <h2 className="text-[clamp(40px,10cqw,64px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-[#101828] mb-5">
          Get paid to record your voice.
        </h2>
        <p className="text-[17px] leading-[1.45] text-[#475467] mb-7">
          Earn <span className="font-bold text-[#246BFD]">$66–$111</span> for a 3-hour
          session. Visit a nearby location and complete simple voice recording tasks.
        </p>

        {/* Location search + browse */}
        <div className="space-y-3">
          <LocationCombobox
            focusSignal={pickerFocus}
            onSiteSelected={handleSiteSelected}
          />

          <button
            type="button"
            onClick={handleBrowseNearby}
            className="w-full h-16 flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-white px-4 text-left"
          >
            <Search className="w-5 h-5 text-[#246BFD] shrink-0" strokeWidth={2} />
            <span className="flex-1 text-base text-gray-900">Browse nearby sessions</span>
            <ChevronRight className="w-5 h-5 text-[#246BFD] shrink-0" strokeWidth={2} />
          </button>
        </div>

        {/* Primary CTA */}
        <div className="mt-5">
          <PrimaryCtaButton
            onClick={handleSeeSessions}
            className="rounded-2xl h-14 py-0 bg-[#294EB2] text-white font-bold hover:bg-[#294EB2]/90"
          >
            See sessions
          </PrimaryCtaButton>
        </div>

        <button
          type="button"
          onClick={() => setEligibilityOpen(true)}
          className="block mt-4 text-base text-[#101828] underline underline-offset-2"
        >
          Log in to check your remaining sessions
        </button>

        <p className="text-xs text-gray-500 mt-3">
          Not currently available to residents of Texas, Washington, or Illinois.
        </p>

        {/* Trust section */}
        <div className="mt-10">
          <h2 className="text-[28px] leading-[1.15] font-bold tracking-tight text-[#101828] mb-6">
            Why people choose Instawork Research
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-4">
              <Sparkles className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">No experience needed</p>
                <p className="text-base text-gray-600 mt-0.5">We'll guide you through every step.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-4">
              <Mic className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-base font-bold text-gray-900">Simple guided session</p>
                <p className="text-base text-gray-600 mt-0.5">Complete simple voice recording tasks.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-white rounded-2xl border border-[hsl(var(--border))] p-4">
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
