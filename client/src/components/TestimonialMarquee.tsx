import { Star } from "lucide-react";
import type { Testimonial } from "@/lib/testimonials";

function Stars({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-[#F5A623] text-[#F5A623]" strokeWidth={0} />
      ))}
    </span>
  );
}

function Card({ t }: { t: Testimonial }) {
  return (
    <figure className="shrink-0 w-[280px] md:w-[320px] rounded-[14px] border border-[#EEE9DD] bg-white px-5 py-4">
      <div className="flex items-center gap-2">
        <Stars count={t.rating} />
        <span className="sr-only">{t.rating} out of 5 stars.</span>
      </div>
      <blockquote className="text-[15px] md:text-[16px] leading-relaxed text-[#11243e] mt-2.5">
        “{t.quote}”
      </blockquote>
      <figcaption className="text-[13px] text-[#8A93A0] mt-2.5">
        — {t.name} · {t.city}
      </figcaption>
    </figure>
  );
}

/**
 * One horizontal row. Two identical card groups sit side by side; the row
 * translates -50% so the loop is seamless. The duplicate group is hidden from
 * assistive tech and removed entirely under reduced motion (static wrap).
 */
function Row({
  items,
  direction,
}: {
  items: Testimonial[];
  direction: "left" | "right";
}) {
  const animClass = direction === "left" ? "animate-marquee-left" : "animate-marquee-right";
  const group = (hidden: boolean) => (
    <div className={`flex gap-4 pr-4 ${hidden ? "motion-reduce:hidden" : ""}`} aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <Card key={`${hidden ? "b" : "a"}-${i}`} t={t} />
      ))}
    </div>
  );
  return (
    <div
      className={`flex w-max ${animClass} group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:flex-wrap motion-reduce:justify-center`}
    >
      {group(false)}
      {group(true)}
    </div>
  );
}

/**
 * Two rows of 5★ Pro quotes that auto-scroll in opposite directions
 * ("rolling / floating"). Pauses on hover and keyboard focus; under
 * prefers-reduced-motion the rows render as a static centered wrap.
 */
export function TestimonialMarquee({ items }: { items: Testimonial[] }) {
  const mid = Math.ceil(items.length / 2);
  const topRow = items.slice(0, mid);
  const bottomRow = items.slice(mid);

  return (
    <div
      className="group relative mt-7 space-y-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none] motion-reduce:overflow-visible"
      aria-label="Reviews from Instawork Pros"
    >
      <Row items={topRow} direction="left" />
      <Row items={bottomRow} direction="right" />
    </div>
  );
}
