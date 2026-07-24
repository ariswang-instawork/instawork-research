import { MapPin } from "lucide-react";
import type { SessionItem } from "@/lib/api-client/generated/api.schemas";

/** Currency, always to exactly two decimals — e.g. "$110.58". */
function formatPay(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Compact session row: date + time, location (venue/neighborhood — the most
 * decision-relevant field for an in-person commitment), estimated total pay,
 * hourly rate × duration, spots remaining, and a "View session" button that
 * continues the existing booking / Instawork deep-link flow.
 */
export function SessionCard({
  session,
  onBook,
}: {
  session: SessionItem;
  onBook: () => void;
}) {
  const payTotal = Number.parseFloat(session.payAmount);
  const payLabel = Number.isFinite(payTotal) ? formatPay(payTotal) : session.payLabel || null;
  const rate =
    session.payRateUsd != null && Number.isFinite(session.payRateUsd)
      ? `${formatPay(session.payRateUsd)}/hr × ${session.billableHours ?? 3} hours`
      : null;
  // Prefer the short neighborhood/venue label; fall back to the full address.
  const location = session.neighborhoodLabel || session.fullAddress || null;
  const spots =
    typeof session.open === "number" && session.open > 0
      ? session.open === 1
        ? "1 spot left"
        : `${session.open} spots open`
      : null;

  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-[#101828] truncate">
          {session.date} · {session.time}
        </p>
        {location && (
          <p className="flex items-center gap-1 text-[14px] text-[#475467] mt-0.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#667085]" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">{location}</span>
          </p>
        )}
        {payLabel && (
          <p className="text-[14px] text-[#101828] mt-0.5">
            <span className="font-semibold">{payLabel}</span> estimated pay
            {rate && <span className="text-[#667085]"> · {rate}</span>}
          </p>
        )}
        {spots && (
          <p
            className={`text-[13px] mt-0.5 ${
              session.open === 1 ? "text-[#C2402F]" : "text-[#475467]"
            }`}
          >
            {spots}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onBook}
        className="shrink-0 inline-flex items-center justify-center h-10 px-4 rounded-[10px] bg-[#23409A] text-white text-[14px] font-semibold transition-[transform,background-color] duration-150 active:scale-[0.98] active:bg-[#1a3179] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23409A]/40"
      >
        View session
      </button>
    </li>
  );
}
