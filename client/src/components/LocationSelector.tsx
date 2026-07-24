import { useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { LocationCombobox } from "@/components/LocationCombobox";
import type { SiteOrigin } from "@/hooks/use-site";

/**
 * Compact location selector: pin icon + current city + "Change" action.
 * Clicking it reveals the existing search combobox for picking a city.
 */
export function LocationSelector({
  label,
  focusSignal = 0,
  onSiteSelected,
  onOpened,
}: {
  label: string | null;
  /** Increment to programmatically open the picker. */
  focusSignal?: number;
  onSiteSelected: (key: string, label: string, origin?: SiteOrigin) => void;
  onOpened?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [comboFocus, setComboFocus] = useState(0);

  // External focus requests open the search field directly.
  const [lastSignal, setLastSignal] = useState(focusSignal);
  if (focusSignal !== lastSignal) {
    setLastSignal(focusSignal);
    if (!editing) setEditing(true);
    setComboFocus((n) => n + 1);
  }

  if (editing) {
    return (
      <LocationCombobox
        autoFocus
        focusSignal={comboFocus}
        onOpened={onOpened}
        onSiteSelected={(key, siteLabel, origin) => {
          onSiteSelected(key, siteLabel, origin);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setEditing(true);
        setComboFocus((n) => n + 1);
      }}
      className="w-full min-h-[52px] flex items-center gap-3 rounded-[14px] border border-[#e4e7ec] bg-white px-4 py-3 text-left transition-colors hover:border-[#c9cfd9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23409A]/40"
    >
      <MapPin className="w-5 h-5 text-[#23409A] shrink-0" strokeWidth={2} />
      <span
        className={`flex-1 min-w-0 truncate text-base ${
          label ? "font-semibold text-[#101828]" : "text-[#667085]"
        }`}
      >
        {label ?? "Enter your city"}
      </span>
      <span className="text-sm font-semibold text-[#23409A] shrink-0 inline-flex items-center gap-0.5">
        {label ? "Change" : "Select"}
        <ChevronDown className="w-4 h-4" strokeWidth={2} />
      </span>
    </button>
  );
}
