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
    <li className="flex items-center justify-between gap-4 py-4 md:py-5">
      <div className="min-w-0">
        <p className="text-[18px] md:text-[20px] font-semibold text-[#11243e] truncate">
          {session.date} · {session.time}
        </p>
        {spots && (
          <p
            className={`text-[16px] mt-1 ${
              session.open === 1 ? "text-[#CF4A42]" : "text-[#576270]"
            }`}
          >
            {spots}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onBook}
        className="shrink-0 text-[16px] font-semibold text-[#3351E6] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3351E6]/40 rounded-sm py-2"
      >
        View session
      </button>
    </li>
  );
}
