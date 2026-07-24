import type { SessionItem } from "@/lib/api-client/generated/api.schemas";

/** Currency, always to exactly two decimals — e.g. "$110.58". */
function formatPay(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Compact session row: date + time, estimated total pay, hourly rate ×
 * duration, spots remaining, and a "View session" action that continues the
 * existing booking / Instawork deep-link flow.
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
        className="shrink-0 text-[14px] font-semibold text-[#23409A] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23409A]/40 rounded-sm py-2"
      >
        View session
      </button>
    </li>
  );
}
