import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

type BackLinkProps = {
  href: string;
  /** Visible label beside the arrow. Omit for icon-only back control. */
  label?: string;
  className?: string;
};

/** Consistent back navigation — labeled (← Sessions) or icon-only. */
export function BackLink({ href, label, className = "" }: BackLinkProps) {
  if (label) {
    return (
      <Link
        href={href}
        className={`inline-flex items-center text-[15px] font-medium text-[#576270] hover:text-[#11243e] transition-colors mb-6 ${className}`}
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center mb-8 -ml-1 ${className}`}
      aria-label="Go back"
    >
      <ArrowLeft className="w-5 h-5 text-foreground" aria-hidden="true" />
    </Link>
  );
}
