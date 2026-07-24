import type { SessionItem } from "@/lib/api-client/generated/api.schemas";

/**
 * Selectable session row: radio indicator, time as the main text,
 * "Earn $X" as secondary text. The whole row toggles selection.
 */
export function SessionOption({
  session,
  payText,
  selected,
  onSelect,
  tabIndex = 0,
}: {
  session: SessionItem;
  payText: string;
  selected: boolean;
  onSelect: () => void;
  /** Roving tabindex managed by the parent radio group. */
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      id={`session-option-${session.id}`}
      tabIndex={tabIndex}
      onClick={onSelect}
      className={`w-full min-h-[56px] flex items-center gap-3 rounded-[14px] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c387d]/40 ${
        selected
          ? "border-[#1c387d] bg-[#1c387d]/[0.06]"
          : "border-[#e4e7ec] bg-white hover:border-[#c9cfd9]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`w-5 h-5 rounded-full border-2 shrink-0 grid place-content-center ${
          selected ? "border-[#1c387d]" : "border-[#c9cfd9]"
        }`}
      >
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#1c387d]" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold text-[#101828]">{session.time}</span>
        <span className="block text-[14px] text-[#475467] mt-0.5">Earn {payText}</span>
      </span>
    </button>
  );
}
