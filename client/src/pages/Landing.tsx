import { useState } from "react";
import { useLocation } from "wouter";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { LocationDrawer } from "@/components/Drawers";
import { BrandRow } from "@/components/BrandRow";
import { SiteLeafletMap } from "@/components/SiteLeafletMap";
import { DEFAULT_SITE, SIGNUP_FORM_URL } from "@/lib/constants";
import { Sparkles, Mic, Wallet } from "lucide-react";
import { PrimaryCtaButton } from "@/components/PrimaryCtaButton";

export default function Landing() {
  const { site, setSite } = useSiteStorage();
  const [, setLocation] = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const displaySite = site || DEFAULT_SITE;

  // Always open the location modal first — never navigate straight to
  // sessions, even when a previous location is stored.
  const handleSeeSessions = () => {
    setIsDrawerOpen(true);
  };

  const handleSiteSelected = (key: string, label: string, origin?: SiteOrigin) => {
    setSite(key, label, origin);
    setIsDrawerOpen(false);
    setLocation("/sessions");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <main className="flex-1 overflow-y-auto px-6 pt-8 pb-[calc(10.5rem+env(safe-area-inset-bottom)+24px)] space-y-8 max-w-md mx-auto w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
        
        <BrandRow />

        <div>
          <h2 className="text-[26px] leading-[1.12] font-bold tracking-tight text-gray-900 mb-4">
            Get paid to record your voice.
          </h2>
          <p className="text-base text-gray-900">
            Earn <span className="font-bold text-primary">$66–$111</span> for a 3-hour session.
          </p>
          <p className="text-base text-gray-600 mt-2">
            Visit a nearby location and complete simple voice recording tasks.
          </p>
        </div>

        <SiteLeafletMap />

        <div className="space-y-7 pt-2">
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

      </main>

      {/* Hidden entirely while the location sheet is open so it can't be seen,
          clicked, or focused behind the modal. */}
      {!isDrawerOpen && (
      <footer className="fixed bottom-0 left-0 right-0 z-[1000] border-t border-[hsl(var(--border))] bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <PrimaryCtaButton onClick={handleSeeSessions}>
          Find a session near me
        </PrimaryCtaButton>
        <p className="text-xs text-center text-gray-500 mt-3">
          Not currently available to residents of Texas, Washington, or Illinois.
        </p>
      </footer>
      )}

      <LocationDrawer 
        isOpen={isDrawerOpen} 
        onOpenChange={setIsDrawerOpen} 
        onSiteSelected={handleSiteSelected} 
      />
    </div>
  );
}
