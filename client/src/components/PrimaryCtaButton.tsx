import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The single primary CTA style used across the app
 * ("Find a session near me", "Check remaining sessions").
 * Both buttons share this component so they stay visually identical.
 */
export const PrimaryCtaButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <Button
      ref={ref}
      className={cn(
        "w-full h-auto rounded-xl bg-primary py-4 text-[17px] font-semibold text-white hover:bg-primary/90 shadow-none transition-transform active:scale-[0.98]",
        className,
      )}
      {...props}
    />
  ),
);
PrimaryCtaButton.displayName = "PrimaryCtaButton";
