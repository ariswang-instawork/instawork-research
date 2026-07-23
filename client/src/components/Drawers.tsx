import { useRef, useState } from "react";
import { useGetSites } from "@/lib/api-client";
import { useAuthStatus, useEligibility, login } from "@/hooks/use-auth";
import { calculateDistance } from "@/lib/zipCentroids";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { MapPin, Navigation, ShieldCheck, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrimaryCtaButton } from "@/components/PrimaryCtaButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

/** Sessions within this many miles of the user count as "nearby". */
const NEARBY_RADIUS_MILES = 50;

type NearbyResult =
  | { kind: "nearby"; key: string; label: string; distanceMiles: number }
  | { kind: "far"; key: string; label: string; distanceMiles: number }
  | { kind: "none" };

export function LocationDrawer({
  isOpen,
  onOpenChange,
  onSiteSelected,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSiteSelected: (key: string, label: string, origin?: SiteOrigin) => void;
}) {
  const { data, isLoading } = useGetSites();
  const { site } = useSiteStorage();
  const [isSearching, setIsSearching] = useState(false);
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Incremented whenever the drawer closes or a new search starts, so
  // late async results from a stale search are ignored (no surprise
  // navigation after the user closed the drawer).
  const searchIdRef = useRef(0);
  // When no open sessions are within 50 miles, we show a result view instead
  // of navigating. `far` keeps the closest option so the user can still book it.
  const [farResult, setFarResult] = useState<
    | { kind: "far"; key: string; label: string; distanceMiles: number; originLabel: string }
    | { kind: "none" }
    | null
  >(null);

  /** Cities that actually have open sessions, alphabetized for the list. */
  const availableSites = (data?.sites ?? [])
    .filter((s) => s.openCount > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  const resetToInput = () => {
    searchIdRef.current++; // Invalidate any in-flight search.
    setFarResult(null);
    setError(null);
    setZip("");
    setIsSearching(false);
  };

  /**
   * Distance + filtering logic:
   * 1. Only sites with coordinates AND at least one open session count.
   * 2. Distance from the user to each site uses the Haversine formula.
   * 3. Sites are sorted nearest-to-farthest; the nearest one wins.
   * 4. If the nearest open site is within 50 miles, we navigate straight to
   *    its sessions. Otherwise we show a "no sessions nearby" view that still
   *    offers the closest option.
   */
  const findNearest = (lat: number, lng: number): NearbyResult => {
    const candidates = (data?.sites ?? [])
      .filter((s) => s.latitude != null && s.longitude != null && s.openCount > 0)
      .map((s) => ({
        key: s.key,
        label: s.label,
        distanceMiles: calculateDistance(lat, lng, s.latitude!, s.longitude!),
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    const nearest = candidates[0];
    if (!nearest) return { kind: "none" };
    const rounded = Math.round(nearest.distanceMiles);
    return {
      kind: nearest.distanceMiles <= NEARBY_RADIUS_MILES ? "nearby" : "far",
      key: nearest.key,
      label: nearest.label,
      distanceMiles: rounded,
    };
  };

  const applyResult = (result: NearbyResult, originLabel: string) => {
    if (result.kind === "nearby") {
      onSiteSelected(result.key, result.label, {
        label: originLabel,
        distanceMiles: result.distanceMiles,
      });
      return;
    }
    if (result.kind === "far") {
      setFarResult({ ...result, originLabel });
      return;
    }
    setFarResult({ kind: "none" });
  };

  const handleGeolocation = () => {
    if (isSearching || isLoading) return; // Prevent duplicate/premature searches.
    setError(null);
    if (!navigator.geolocation) {
      setError("We couldn\u2019t access your location. Enter your ZIP code instead.");
      return;
    }
    const searchId = ++searchIdRef.current;
    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (searchIdRef.current !== searchId) return; // Drawer closed/reset — ignore.
        setIsSearching(false);
        applyResult(
          findNearest(pos.coords.latitude, pos.coords.longitude),
          "your current location",
        );
      },
      () => {
        if (searchIdRef.current !== searchId) return;
        setIsSearching(false);
        setError("We couldn\u2019t access your location. Enter your ZIP code instead.");
      },
      { timeout: 10000 }
    );
  };

  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against duplicate searches AND Enter-key submits before sites load.
    if (isSearching || isLoading) return;
    setError(null);
    const cleanZip = zip.trim();
    if (!/^\d{5}$/.test(cleanZip)) {
      setError("Enter a valid 5-digit ZIP code.");
      return;
    }
    const searchId = ++searchIdRef.current;
    setIsSearching(true);
    try {
      // ZIP → coordinates happens server-side so no third-party geocoding
      // calls (or keys) live in the frontend.
      const resp = await fetch(
        `${import.meta.env.BASE_URL}api/geocode-zip?zip=${cleanZip}`,
      );
      if (searchIdRef.current !== searchId) return; // Drawer closed/reset — ignore.
      if (!resp.ok) {
        setError(
          resp.status === 404 || resp.status === 400
            ? "Enter a valid 5-digit ZIP code."
            : "Could not look up that ZIP code right now.",
        );
        return;
      }
      const coords = (await resp.json()) as { latitude: number; longitude: number };
      if (searchIdRef.current !== searchId) return;
      applyResult(findNearest(coords.latitude, coords.longitude), cleanZip);
    } catch {
      if (searchIdRef.current !== searchId) return;
      setError("Could not look up that ZIP code right now.");
    } finally {
      if (searchIdRef.current === searchId) setIsSearching(false);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) resetToInput(); onOpenChange(open); }}>
      <DrawerContent className="max-w-[480px] mx-auto">
        {farResult ? (
          <div className="w-full max-w-[448px] mx-auto p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
              <MapPin className="w-8 h-8" />
            </div>
            <DrawerHeader className="p-0 mb-6">
              <DrawerTitle className="text-[19px] font-semibold mb-2">
                {farResult.kind === "far"
                  ? "No sessions nearby right now"
                  : "No sessions available right now"}
              </DrawerTitle>
              <DrawerDescription className="text-muted-foreground">
                {farResult.kind === "far"
                  ? `The closest available session is ${farResult.distanceMiles} miles away.`
                  : "Check back soon for new session openings."}
              </DrawerDescription>
            </DrawerHeader>
            <div className="w-full space-y-3 max-w-sm">
              {farResult.kind === "far" && (
                <Button
                  size="lg"
                  className="w-full h-14 rounded-xl text-[16px] font-semibold bg-primary hover:bg-primary/90 text-white shadow-none"
                  onClick={() =>
                    onSiteSelected(farResult.key, farResult.label, {
                      label: farResult.originLabel,
                      distanceMiles: farResult.distanceMiles,
                    })
                  }
                >
                  View closest session
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="w-full h-14 rounded-xl text-[16px] font-semibold border-primary text-primary bg-white hover:bg-primary/5 hover:text-primary shadow-none"
                onClick={resetToInput}
              >
                Try another ZIP code
              </Button>
            </div>
            <p className="mt-8 text-xs text-muted-foreground font-medium flex items-center gap-1.5 pb-safe">
              <ShieldCheck className="w-4 h-4" />
              We only use your location to find nearby sessions.
            </p>
          </div>
        ) : (
        <div className="w-full max-w-[448px] mx-auto px-6 pb-6 pt-2 flex flex-col">
          <DrawerHeader className="p-0 mb-5 relative text-left">
            <DrawerTitle className="text-[19px] font-semibold pr-10">Find sessions near you</DrawerTitle>
            <DrawerDescription className="text-muted-foreground">
              Share your location, enter your ZIP code, or pick a city.
            </DrawerDescription>
            <DrawerClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="absolute right-0 top-0 w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-gray-900 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </DrawerClose>
          </DrawerHeader>

          <div className="w-full space-y-4">
            <Button
              size="lg"
              className="w-full h-14 rounded-xl text-[16px] font-semibold bg-primary hover:bg-primary/90 text-white shadow-none"
              onClick={handleGeolocation}
              disabled={isSearching || isLoading}
            >
              {isSearching ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Searching...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5" />
                  Use my current location
                </div>
              )}
            </Button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm font-medium">or</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <form onSubmit={handleZipSubmit} className="space-y-1.5 text-left">
              <Label htmlFor="zip-input" className="text-sm font-medium text-foreground">ZIP code</Label>
              <div className="flex gap-2">
              <Input
                id="zip-input"
                placeholder="Enter ZIP code"
                value={zip}
                onChange={(e) => { setZip(e.target.value); setError(null); }}
                className="h-12 rounded-xl text-[16px] bg-secondary/50 border-transparent focus-visible:bg-background focus-visible:ring-primary/20 transition-all"
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={5}
                autoComplete="postal-code"
              />
              <Button
                type="submit"
                size="lg"
                className="h-12 rounded-xl px-5 bg-secondary text-foreground hover:bg-secondary/80 shrink-0 font-semibold"
                disabled={isLoading || isSearching || !zip}
              >
                Search
              </Button>
              </div>
            </form>

            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm font-medium">or choose a city</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <div
              className="overflow-y-auto max-h-[32dvh] -mx-2 pb-safe"
              role="listbox"
              aria-label="Available cities"
            >
              {isLoading ? (
                <p className="text-sm text-muted-foreground px-2 py-3">Loading cities…</p>
              ) : availableSites.length === 0 ? (
                <p className="text-sm text-muted-foreground px-2 py-3">
                  No cities available right now — check back soon.
                </p>
              ) : (
                availableSites.map((s) => {
                  const selected = site?.key === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => onSiteSelected(s.key, s.label)}
                      className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        selected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-gray-900 hover:bg-secondary/60"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <MapPin
                          className={`w-[18px] h-[18px] shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
                          strokeWidth={2}
                        />
                        {s.label}
                      </span>
                      {selected && <Check className="w-5 h-5 shrink-0" strokeWidth={2.5} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

export function EligibilityCheckDrawer({
  suppressed = false,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  suppressed?: boolean;
  /** Optional controlled open state (e.g. opened from a header/landing link). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in fixed footer trigger entirely. */
  hideTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const setIsOpen = (v: boolean) => {
    setUncontrolledOpen(v);
    onOpenChange?.(v);
  };

  const { data: auth, isLoading: authLoading } = useAuthStatus();
  const isAuthenticated = !!auth?.authenticated;
  // Only fetch eligibility once logged in AND the drawer is open.
  const eligibility = useEligibility(isAuthenticated && isOpen);

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      {/* Same viewport-fixed CTA container as the Landing "Find a session near me" footer.
          Removed entirely while this drawer or any other modal is open so it
          can't be seen, clicked, or focused behind the sheet. */}
      {!isOpen && !suppressed && !hideTrigger && (
        <footer className="fixed bottom-0 left-0 right-0 z-[1000] border-t border-[hsl(var(--border))] bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto w-full">
            <p className="text-[14px] font-normal text-foreground text-center mb-2">Already booked or completed a session?</p>
            <PrimaryCtaButton onClick={() => setIsOpen(true)}>Check remaining sessions</PrimaryCtaButton>
          </div>
        </footer>
      )}
      <DrawerContent className="max-w-[480px] mx-auto">
        <div className="w-full max-w-[448px] mx-auto">
          <DrawerHeader>
            <DrawerTitle>
              {isAuthenticated ? "Your remaining sessions" : "Check remaining sessions"}
            </DrawerTitle>
            <DrawerDescription>
              {isAuthenticated
                ? "Based on your Instawork account."
                : "Log in with your Instawork account to see how many sessions you can still book."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 space-y-3">
            {!isAuthenticated ? null : eligibility.isLoading ? (
              <div className="space-y-3">
                <div className="h-14 rounded-xl bg-muted animate-pulse" />
                <div className="h-14 rounded-xl bg-muted animate-pulse" />
              </div>
            ) : eligibility.isError ? (
              <div className="p-4 rounded-xl text-sm font-medium border bg-destructive/10 text-destructive border-destructive/20">
                Could not check eligibility right now.
              </div>
            ) : eligibility.data && eligibility.data.sites.length === 0 ? (
              <div className="p-4 rounded-xl text-sm font-medium border bg-muted text-muted-foreground border-transparent">
                Looks like you haven't booked one yet — you can book up to 3.
              </div>
            ) : (
              eligibility.data?.sites.map((s) => (
                <div
                  key={s.businessId}
                  className={`p-4 rounded-xl border ${
                    s.isBlocked
                      ? "bg-amber-50 border-amber-200"
                      : "bg-white border-[hsl(var(--border))]"
                  }`}
                >
                  <p className="text-[15px] font-bold text-gray-900">
                    {s.siteLabel ?? "Session site"}
                  </p>
                  {s.isBlocked ? (
                    <p className="text-sm font-medium text-amber-900 mt-0.5">
                      You can't book more sessions at this site.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {s.remaining} of {s.cap} session{s.cap === 1 ? "" : "s"} remaining
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <DrawerFooter className="pb-safe pt-2">
            {!isAuthenticated && (
              <Button
                className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-none"
                onClick={login}
                disabled={authLoading}
              >
                Log in with Instawork
              </Button>
            )}
            <DrawerClose asChild>
              <Button variant="ghost" className="h-12 rounded-xl font-normal text-muted-foreground">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
