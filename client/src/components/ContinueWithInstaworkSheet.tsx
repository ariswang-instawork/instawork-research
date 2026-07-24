import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { INSTAWORK_LOGIN_URL, INSTAWORK_SIGNUP_URL } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

/**
 * "Continue with Instawork" bottom sheet. Both auth paths carry the shift's
 * universal link (`bookUrl`) as `return_url`, so the visitor lands back on
 * the same session after logging in or signing up.
 */
export function ContinueWithInstaworkSheet({
  open,
  onOpenChange,
  bookUrl,
  analyticsProps = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookUrl?: string | null;
  analyticsProps?: AnalyticsProps;
}) {
  const buildAuthUrl = (base: string) => {
    if (!bookUrl) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}return_url=${encodeURIComponent(bookUrl)}`;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto">
        <DrawerClose asChild>
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 p-1 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </DrawerClose>
        <DrawerHeader className="text-left px-6 pt-2">
          <DrawerTitle className="text-[20px]">Continue with Instawork</DrawerTitle>
          <DrawerDescription className="text-[15px]">
            Do you already have an Instawork account?
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-3">
          <Button
            className="w-full h-[52px] rounded-xl text-[17px] font-semibold bg-primary hover:bg-primary/90 shadow-none"
            onClick={() => {
              trackEvent("existing_user_selected", analyticsProps);
              trackEvent("instawork_login_selected", analyticsProps);
              trackEvent("instawork_redirect_started", { ...analyticsProps, destination: "login" });
              window.open(buildAuthUrl(INSTAWORK_LOGIN_URL), "_blank", "noopener,noreferrer");
              onOpenChange(false);
            }}
          >
            Log in
          </Button>
          <Button
            variant="outline"
            className="w-full h-[52px] rounded-xl text-[17px] font-semibold border-primary text-primary hover:bg-primary/5 shadow-none"
            onClick={() => {
              trackEvent("new_user_selected", analyticsProps);
              trackEvent("instawork_signup_selected", analyticsProps);
              trackEvent("instawork_redirect_started", { ...analyticsProps, destination: "signup" });
              window.open(buildAuthUrl(INSTAWORK_SIGNUP_URL), "_blank", "noopener,noreferrer");
              onOpenChange(false);
            }}
          >
            Create an account
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
