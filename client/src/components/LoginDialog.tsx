import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { login } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/** Minimal login prompt — used when a returning user hits a gated action. */
export function LoginDialog({
  open,
  onOpenChange,
  returnTo = "/my-sessions",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnTo?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-[360px] translate-x-[-50%] translate-y-[-50%]",
            "border border-[#EEE9DD] bg-background p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-[16px]",
          )}
        >
          <DialogPrimitive.Title className="text-[18px] font-bold text-[#11243e] text-center">
            Log in to see your sessions
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-[15px] text-[#576270] mt-2 text-center leading-relaxed">
            Use your Instawork account.
          </DialogPrimitive.Description>
          <button
            type="button"
            onClick={() => login(returnTo)}
            className="mt-5 w-full h-12 rounded-[8px] font-semibold text-[16px] text-white bg-cta-gradient hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3351E6]/40"
          >
            Log in with Instawork
          </button>
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#3351E6]/40">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
