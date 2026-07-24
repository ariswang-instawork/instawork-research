import { BadgeDollarSign, Clock, Wallet } from "lucide-react";

/** Compact key-details row: total pay · duration · payment method. */
export function ResearchSummary({ payText }: { payText: string | null }) {
  const items = [
    payText ? { icon: BadgeDollarSign, label: `${payText} total` } : null,
    { icon: Clock, label: "3 hours" },
    { icon: Wallet, label: "Paid through Instawork" },
  ].filter(Boolean) as { icon: typeof Clock; label: string }[];

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-1.5 text-[15px] font-medium text-[#344054]">
          <Icon className="w-4 h-4 text-[#1c387d]" strokeWidth={2} />
          {label}
        </li>
      ))}
    </ul>
  );
}
