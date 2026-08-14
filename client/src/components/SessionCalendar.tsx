import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SessionItem } from "@/lib/api-client/generated/api.schemas";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function parseISO(dateISO: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateISO.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

/**
 * Month calendar for one site's open sessions, grouped by dateISO. Days with
 * openings get a dot and are clickable; the selected day's time slots render
 * below the grid. Month navigation is bounded to the range of months present
 * in `sessions` — everything is already loaded, there is nothing more to fetch.
 */
export function SessionCalendar({
  sessions,
  onBook,
  actionLabel = "Book",
}: {
  sessions: SessionItem[];
  onBook: (session: SessionItem) => void;
  /** Button label for each slot — "Book" (site detail, opens bookUrl directly)
   * or "View session" (landing, routes to the session-detail page first). */
  actionLabel?: string;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, SessionItem[]>();
    for (const s of sessions) {
      const list = map.get(s.dateISO);
      if (list) list.push(s);
      else map.set(s.dateISO, [s]);
    }
    map.forEach((list) => {
      list.sort((a, b) => a.time.localeCompare(b.time));
    });
    return map;
  }, [sessions]);

  const sortedDates = useMemo(() => Array.from(byDate.keys()).sort(), [byDate]);
  const firstDate = sortedDates[0] ?? null;
  const lastDate = sortedDates[sortedDates.length - 1] ?? null;

  const initial = firstDate ? parseISO(firstDate) : null;
  const [viewYear, setViewYear] = useState(initial?.year ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(initial?.month ?? new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(firstDate);

  if (sortedDates.length === 0) {
    return <p className="text-[18px] md:text-[20px] leading-[1.5] text-[#576270]">No open shifts right now.</p>;
  }

  const minKey = firstDate ? monthKey(parseISO(firstDate).year, parseISO(firstDate).month) : null;
  const maxKey = lastDate ? monthKey(parseISO(lastDate).year, parseISO(lastDate).month) : null;
  const currentKey = monthKey(viewYear, viewMonth);
  const canGoPrev = minKey !== null && currentKey > minKey;
  const canGoNext = maxKey !== null && currentKey < maxKey;

  const goPrev = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const cells: Array<{ day: number; dateISO: string } | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, dateISO: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    }),
  ];

  const monthLabel = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedSessions = selectedDate ? byDate.get(selectedDate) ?? [] : [];
  const selectedLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-[14px] border border-[#EEE9DD] bg-white p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            aria-label="Previous month"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#576270] enabled:hover:bg-[#FAFAF8] enabled:hover:text-[#11243e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-[18px] md:text-[20px] font-bold text-[#11243e]">{monthLabel}</p>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            aria-label="Next month"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#576270] enabled:hover:bg-[#FAFAF8] enabled:hover:text-[#11243e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[13px] md:text-[14px] font-medium text-[#8A93A0] py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`blank-${i}`} />;
            const hasSessions = byDate.has(cell.dateISO);
            const isSelected = cell.dateISO === selectedDate;
            return (
              <button
                key={cell.dateISO}
                type="button"
                disabled={!hasSessions}
                onClick={() => setSelectedDate(cell.dateISO)}
                className={`aspect-square flex flex-col items-center justify-center rounded-[10px] text-[15px] md:text-[16px] transition-colors ${
                  isSelected
                    ? "bg-[#3351E6]/10 text-[#3351E6] font-bold"
                    : hasSessions
                      ? "text-[#11243e] font-medium hover:bg-[#FAFAF8] cursor-pointer"
                      : "text-[#C4CAD2] cursor-default"
                }`}
              >
                <span>{cell.day}</span>
                <span
                  className={`mt-0.5 w-1 h-1 rounded-full ${
                    hasSessions ? (isSelected ? "bg-[#3351E6]" : "bg-[#3351E6]/60") : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {selectedLabel && (
        <div>
          <p className="text-[20px] md:text-[24px] leading-[1.2] font-bold tracking-tight text-[#11243e] mb-3">
            {selectedLabel}
          </p>
          {selectedSessions.length === 0 ? (
            <p className="text-[18px] md:text-[20px] leading-[1.5] text-[#576270]">No sessions this day.</p>
          ) : (
            <div className="rounded-[14px] border border-[#EEE9DD] bg-white overflow-hidden divide-y divide-[#EEE9DD]">
              {selectedSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 md:gap-4 px-4 py-3.5 md:px-6 md:py-5">
                  <span className="text-[15px] md:text-[20px] font-semibold text-[#11243e] min-w-0 shrink">
                    {s.time}
                  </span>
                  <button
                    type="button"
                    onClick={() => onBook(s)}
                    className="shrink-0 text-[13px] md:text-[17px] font-semibold text-white bg-cta-gradient rounded-[8px] px-3.5 py-2 md:px-5 md:py-2.5 hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3351E6]/40"
                  >
                    {actionLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
