import type { SessionItem } from "@/lib/api-client/generated/api.schemas";

/** Compact session row: date, time, spots remaining, one text-link action. */
export function SessionCard({
  session,
  onBook,
}: {
  session: SessionItem;
  onBook: () => void;
}) {
  const spots =
    typeof session.open === "number" && session.open > 0
      ? session.open === 1
        ? "1 spot left"
        : `${session.open} spots open`
      : null;

  return (
    <li className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-[#101828] truncate">
          {session.date} · {session.time}
        </p>
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
