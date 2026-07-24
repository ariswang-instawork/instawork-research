import type { SessionItem } from "@/lib/api-client/generated/api.schemas";

/** Marketplace-style session card with its own booking CTA. */
export function SessionCard({
  session,
  payText,
  cityLabel,
  onBook,
}: {
  session: SessionItem;
  payText: string;
  cityLabel: string;
  onBook: () => void;
}) {
  const rate =
    session.payRateUsd != null && Number.isFinite(session.payRateUsd)
      ? `$${session.payRateUsd.toFixed(2)}/hr × ${session.billableHours ?? 3} hours`
      : null;
  const spots =
    typeof session.open === "number" && session.open > 0
      ? session.open === 1
        ? "1 spot left"
        : `${session.open} spots open`
      : null;

  return (
    <div className="rounded-[16px] border border-[#e4e7ec] bg-white p-5 flex flex-col gap-3">
      <div>
        <p className="text-[16px] font-bold text-[#101828]">{session.date}</p>
        <p className="text-[15px] text-[#475467] mt-0.5">{session.time}</p>
      </div>
      <div>
        <p className="text-[20px] font-extrabold tracking-tight text-[#101828]">
          {payText}{" "}
          <span className="text-[14px] font-medium text-[#475467]">estimated pay</span>
        </p>
        {rate && <p className="text-[14px] text-[#475467] mt-0.5">{rate}</p>}
      </div>
      <div className="flex items-center gap-2 text-[14px] text-[#475467]">
        <span>{cityLabel}</span>
        {spots && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-[#1c387d] font-medium">{spots}</span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onBook}
        className="mt-auto w-full h-12 rounded-[14px] bg-[#1c387d] text-white text-[15px] font-semibold transition-[transform,background-color] duration-150 active:scale-[0.99] active:bg-[#16295e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c387d]/40"
      >
        Book in the Instawork app
      </button>
    </div>
  );
}
