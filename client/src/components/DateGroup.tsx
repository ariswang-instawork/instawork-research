import type { ReactNode } from "react";

/** Date heading with its group of session rows. */
export function DateGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[13px] font-bold tracking-wide uppercase text-[#667085] mb-2">
        {label}
      </h3>
      <div className="space-y-2" role="radiogroup" aria-label={`Sessions on ${label}`}>
        {children}
      </div>
    </section>
  );
}
