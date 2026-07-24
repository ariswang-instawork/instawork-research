import type { SessionItem } from "@/lib/api-client/generated/api.schemas";

/**
 * Sticky bottom action bar for the session picker. Disabled until a
 * session is selected; shows the chosen date/time and pay.
 */
export function StickyBookingBar({
  session,
  payText,
  onContinue,
}: {
  session: SessionItem | null;
  payText: string | null;
  onContinue: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#e4e7ec] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="max-w-[720px] mx-auto w-full flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          {session ? (
            <>
              <p className="text-[15px] font-semibold text-[#101828] truncate">
                {session.date} · {session.time}
              </p>
              {payText && <p className="text-[14px] text-[#475467]">Earn {payText}</p>}
            </>
          ) : (
            <p className="text-[14px] text-[#667085]">Select a session to continue</p>
          )}
        </div>
        <button
          type="button"
          disabled={!session}
          onClick={onContinue}
          className="w-full sm:w-auto shrink-0 h-[54px] px-6 rounded-[14px] bg-[#1c387d] text-white text-[16px] font-semibold transition-colors active:bg-[#16295e] disabled:bg-[#e4e7ec] disabled:text-[#98a2b3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c387d]/40"
        >
          Continue in the Instawork app
        </button>
      </div>
    </div>
  );
}
