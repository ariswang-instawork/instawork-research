import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useGetSites } from "@/lib/api-client";
import { calculateDistance } from "@/lib/zipCentroids";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { Check, LocateFixed, MapPin, Send } from "lucide-react";

/** Sessions within this many miles of the user count as "nearby". */
const NEARBY_RADIUS_MILES = 50;

type NearbyResult =
  | { kind: "nearby"; key: string; label: string; distanceMiles: number }
  | { kind: "far"; key: string; label: string; distanceMiles: number }
  | { kind: "none" };

/**
 * Inline location picker: a search field with a dropdown panel anchored
 * directly beneath it (maps/rideshare pattern). Options, in order:
 *   1. "Use my current location" (geolocation → nearest open site ≤50 mi)
 *   2. Available cities from GET /api/sites (openCount > 0), type-ahead filtered
 *   3. A "Search ZIP xxxxx" row when the text is a 5-digit ZIP
 */
export function LocationCombobox({
  onSiteSelected,
  autoFocus = false,
  focusSignal = 0,
  className = "",
  onOpened,
}: {
  onSiteSelected: (key: string, label: string, origin?: SiteOrigin) => void;
  autoFocus?: boolean;
  /** Increment to programmatically focus the field and open the dropdown. */
  focusSignal?: number;
  className?: string;
  /** Fired whenever the dropdown transitions from closed to open (any path). */
  onOpened?: () => void;
}) {
  const { data, isLoading } = useGetSites();
  const { site } = useSiteStorage();
  const [open, setOpen] = useState(false);
  // Shows the selected city when idle; acts as the filter while typing.
  const [query, setQuery] = useState(() => site?.label ?? "");
  const [selectedLabel, setSelectedLabel] = useState(() => site?.label ?? "");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When the nearest open site is >50 miles away, keep it around so the user
  // can still pick it explicitly.
  const [farOption, setFarOption] = useState<{
    key: string;
    label: string;
    distanceMiles: number;
    originLabel: string;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchIdRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Notify on every closed -> open transition, regardless of trigger path.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) onOpened?.();
    wasOpenRef.current = open;
  }, [open, onOpened]);

  const availableSites = useMemo(
    () =>
      (data?.sites ?? [])
        .filter((s) => s.openCount > 0)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [data],
  );

  const trimmed = query.trim();
  const isZip = /^\d{5}$/.test(trimmed);
  const filteredSites = useMemo(() => {
    const q = trimmed.toLowerCase();
    // Don't filter by the already-selected label — show the full list.
    if (!q || isZip || trimmed === selectedLabel) return availableSites;
    return availableSites.filter(
      (s) => s.label.toLowerCase().includes(q) || s.city.toLowerCase().includes(q),
    );
  }, [availableSites, trimmed, isZip]);

  // Flat option list for keyboard navigation. Order mirrors the rendered rows.
  type Option =
    | { type: "geo" }
    | { type: "zip"; zip: string }
    | { type: "far" }
    | { type: "city"; key: string; label: string };
  const options: Option[] = useMemo(() => {
    const opts: Option[] = [{ type: "geo" }];
    if (isZip) opts.push({ type: "zip", zip: trimmed });
    if (farOption) opts.push({ type: "far" });
    for (const s of filteredSites) opts.push({ type: "city", key: s.key, label: s.label });
    return opts;
  }, [isZip, trimmed, farOption, filteredSites]);

  // Keep the active index valid when the option list shrinks (e.g. while
  // typing filters cities), so aria-activedescendant never points at a
  // non-rendered row.
  useEffect(() => {
    setActiveIndex((i) => (i >= options.length ? options.length - 1 : i));
  }, [options.length]);

  const resetTransient = () => {
    searchIdRef.current++;
    setError(null);
    setFarOption(null);
    setIsSearching(false);
    setActiveIndex(-1);
  };

  const close = () => {
    setOpen(false);
    // Restore the selected city label (or clear an abandoned search).
    setQuery(selectedLabel);
    resetTransient();
  };

  // Close on tap/click outside and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        inputRef.current?.blur();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (focusSignal > 0) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      setOpen(true);
    }
  }, [focusSignal]);

  const selectSite = (key: string, label: string, origin?: SiteOrigin) => {
    setOpen(false);
    setSelectedLabel(label);
    setQuery(label);
    resetTransient();
    onSiteSelected(key, label, origin);
  };

  const findNearest = (lat: number, lng: number): NearbyResult => {
    const candidates = availableSites
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({
        key: s.key,
        label: s.label,
        distanceMiles: calculateDistance(lat, lng, s.latitude!, s.longitude!),
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
    const nearest = candidates[0];
    if (!nearest) return { kind: "none" };
    return {
      kind: nearest.distanceMiles <= NEARBY_RADIUS_MILES ? "nearby" : "far",
      key: nearest.key,
      label: nearest.label,
      distanceMiles: Math.round(nearest.distanceMiles),
    };
  };

  const applyResult = (result: NearbyResult, originLabel: string) => {
    if (result.kind === "nearby") {
      selectSite(result.key, result.label, {
        label: originLabel,
        distanceMiles: result.distanceMiles,
      });
      return;
    }
    if (result.kind === "far") {
      setFarOption({ ...result, originLabel });
      setError(null);
      return;
    }
    setError("No sessions in that area yet.");
  };

  const handleGeolocation = () => {
    if (isSearching || isLoading) return;
    setError(null);
    setFarOption(null);
    if (!navigator.geolocation) {
      setError("We couldn\u2019t access your location. Enter your ZIP code instead.");
      return;
    }
    const searchId = ++searchIdRef.current;
    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (searchIdRef.current !== searchId) return;
        setIsSearching(false);
        applyResult(findNearest(pos.coords.latitude, pos.coords.longitude), "your current location");
      },
      () => {
        if (searchIdRef.current !== searchId) return;
        setIsSearching(false);
        setError("We couldn\u2019t access your location. Enter your ZIP code instead.");
      },
      { timeout: 10000 },
    );
  };

  const handleZipSearch = async (zip: string) => {
    if (isSearching || isLoading) return;
    setError(null);
    setFarOption(null);
    const searchId = ++searchIdRef.current;
    setIsSearching(true);
    try {
      // ZIP → coordinates happens server-side so no third-party geocoding
      // calls (or keys) live in the frontend.
      const resp = await fetch(`${import.meta.env.BASE_URL}api/geocode-zip?zip=${zip}`);
      if (searchIdRef.current !== searchId) return;
      if (!resp.ok) {
        setError(
          resp.status === 404 || resp.status === 400
            ? "No sessions in that area yet."
            : "Could not look up that ZIP code right now.",
        );
        return;
      }
      const coords = (await resp.json()) as { latitude: number; longitude: number };
      if (searchIdRef.current !== searchId) return;
      applyResult(findNearest(coords.latitude, coords.longitude), zip);
    } catch {
      if (searchIdRef.current !== searchId) return;
      setError("Could not look up that ZIP code right now.");
    } finally {
      if (searchIdRef.current === searchId) setIsSearching(false);
    }
  };

  const activateOption = (opt: Option) => {
    if (opt.type === "geo") handleGeolocation();
    else if (opt.type === "zip") handleZipSearch(opt.zip);
    else if (opt.type === "far" && farOption)
      selectSite(farOption.key, farOption.label, {
        label: farOption.originLabel,
        distanceMiles: farOption.distanceMiles,
      });
    else if (opt.type === "city") selectSite(opt.key, opt.label);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length) activateOption(options[activeIndex]);
      else if (isZip) handleZipSearch(trimmed);
      else if (filteredSites.length === 1)
        selectSite(filteredSites[0].key, filteredSites[0].label);
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;
  const rowBase =
    "w-full min-h-[44px] flex items-center gap-3 px-4 py-2.5 text-left text-[16px] cursor-pointer focus-visible:outline-none focus:bg-secondary/60 data-[active=true]:bg-secondary/60";

  // Index bookkeeping so aria-activedescendant matches rendered rows.
  let idx = -1;
  const nextIdx = () => ++idx;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Search field */}
      <div className="relative">
        <MapPin
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3351E6] pointer-events-none"
          strokeWidth={2}
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-label="Choose a city or ZIP code"
          autoComplete="off"
          placeholder="Enter city or ZIP code"
          value={query}
          onFocus={(e) => {
            setOpen(true);
            // Select the existing city label so typing replaces it.
            e.target.select();
          }}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError(null);
            setFarOption(null);
            setActiveIndex(-1);
          }}
          onKeyDown={handleInputKeyDown}
          className="w-full h-16 rounded-2xl border border-[hsl(var(--border))] bg-white pl-12 pr-12 text-base text-gray-900 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors duration-150 active:bg-[#FCFBF9]"
        />
        <button
          type="button"
          aria-label={open ? "Close location suggestions" : "Open location suggestions"}
          onClick={() => (open ? close() : (setOpen(true), inputRef.current?.focus()))}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-[#3351E6] hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Send className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      {/* Dropdown panel anchored under the field */}
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Locations"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl border border-[hsl(var(--border))] bg-white shadow-lg overflow-hidden py-1.5 max-h-[min(60dvh,420px)] overflow-y-auto"
        >
          {/* 1. Use my current location */}
          {(() => {
            const i = nextIdx();
            return (
              <div
                id={optionId(i)}
                role="option"
                aria-selected={false}
                data-active={activeIndex === i}
                tabIndex={-1}
                onClick={handleGeolocation}
                className={rowBase}
              >
                <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {isSearching ? (
                    <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <LocateFixed className="w-[18px] h-[18px]" strokeWidth={2} />
                  )}
                </span>
                <span>
                  <span className="block font-bold text-gray-900">Use my current location</span>
                  <span className="block text-sm text-muted-foreground">Find sessions near you</span>
                </span>
              </div>
            );
          })()}

          {/* 2. Search ZIP row (only when the text is a 5-digit ZIP) */}
          {isZip &&
            (() => {
              const i = nextIdx();
              return (
                <div
                  id={optionId(i)}
                  role="option"
                  aria-selected={false}
                  data-active={activeIndex === i}
                  tabIndex={-1}
                  onClick={() => handleZipSearch(trimmed)}
                  className={rowBase}
                >
                  <span className="w-9 h-9 rounded-full bg-secondary text-gray-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-[18px] h-[18px]" strokeWidth={2} />
                  </span>
                  <span className="font-semibold text-gray-900">Search ZIP {trimmed}</span>
                </div>
              );
            })()}

          {/* Closest-but-far option after a search whose nearest site is >50 mi */}
          {farOption &&
            (() => {
              const i = nextIdx();
              return (
                <div
                  id={optionId(i)}
                  role="option"
                  aria-selected={false}
                  data-active={activeIndex === i}
                  tabIndex={-1}
                  onClick={() =>
                    selectSite(farOption.key, farOption.label, {
                      label: farOption.originLabel,
                      distanceMiles: farOption.distanceMiles,
                    })
                  }
                  className={rowBase}
                >
                  <span className="w-9 h-9 rounded-full bg-secondary text-gray-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-[18px] h-[18px]" strokeWidth={2} />
                  </span>
                  <span>
                    <span className="block font-semibold text-gray-900">{farOption.label}</span>
                    <span className="block text-sm text-muted-foreground">
                      Closest sessions — {farOption.distanceMiles} miles away
                    </span>
                  </span>
                </div>
              );
            })()}

          {error && (
            <p className="px-4 py-2.5 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="mx-4 my-1 border-t border-[hsl(var(--border))]" />

          {/* 3. Available cities */}
          {isLoading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Loading cities…</p>
          ) : filteredSites.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {trimmed && !isZip
                ? "No sessions in that area yet."
                : "No cities available right now — check back soon."}
            </p>
          ) : (
            filteredSites.map((s) => {
              const i = nextIdx();
              const selected = site?.key === s.key;
              return (
                <div
                  key={s.key}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  data-active={activeIndex === i}
                  tabIndex={-1}
                  onClick={() => selectSite(s.key, s.label)}
                  className={`${rowBase} ${selected ? "text-primary font-semibold" : "text-gray-900"}`}
                >
                  <MapPin
                    className={`w-[18px] h-[18px] shrink-0 ml-[9px] mr-[9px] ${selected ? "text-primary" : "text-muted-foreground"}`}
                    strokeWidth={2}
                  />
                  <span className="flex-1">{s.label}</span>
                  {selected && <Check className="w-5 h-5 shrink-0 text-primary" strokeWidth={2.5} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
