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
        "w-full h-auto rounded-[8px] bg-cta-gradient py-4 text-[17px] font-semibold text-white hover:brightness-105 shadow-none transition-[transform,filter] active:scale-[0.98] active:brightness-95",
        className,
      )}
      {...props}
    />
  ),
);
PrimaryCtaButton.displayName = "PrimaryCtaButton";
