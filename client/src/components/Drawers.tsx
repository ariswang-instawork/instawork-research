import { useState } from "react";
import { useGetSites, useCheckEligibility } from "@/lib/api-client";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { MapPin, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrimaryCtaButton } from "@/components/PrimaryCtaButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

export function LocationDrawer({
  isOpen,
  onOpenChange,
  onSiteSelected,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSiteSelected: (key: string, label: string, origin?: SiteOrigin) => void;
}) {
  const { data, isLoading } = useGetSites();
  const { site } = useSiteStorage();

  /** Cities that actually have open sessions, alphabetized for the list. */
  const availableSites = (data?.sites ?? [])
    .filter((s) => s.openCount > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-[480px] mx-auto">
        <div className="w-full max-w-[448px] mx-auto px-6 pb-6 pt-2 flex flex-col">
          <DrawerHeader className="p-0 mb-4 relative text-left">
            <DrawerTitle className="text-[19px] font-semibold pr-10">Find sessions near you</DrawerTitle>
            <DrawerDescription className="text-muted-foreground">
              Choose a city to see available sessions.
            </DrawerDescription>
            <DrawerClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="absolute right-0 top-0 w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-gray-900 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </DrawerClose>
          </DrawerHeader>

          <div
            className="overflow-y-auto max-h-[55dvh] -mx-2 pb-safe"
            role="listbox"
            aria-label="Available cities"
          >
            {isLoading ? (
              <p className="text-sm text-muted-foreground px-2 py-3">Loading cities…</p>
            ) : availableSites.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-3">
                No cities available right now — check back soon.
              </p>
            ) : (
              availableSites.map((s) => {
                const selected = site?.key === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onSiteSelected(s.key, s.label)}
                    className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      selected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-gray-900 hover:bg-secondary/60"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <MapPin
                        className={`w-[18px] h-[18px] shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
                        strokeWidth={2}
                      />
                      {s.label}
                    </span>
                    {selected && <Check className="w-5 h-5 shrink-0" strokeWidth={2.5} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function EligibilityCheckDrawer({
  suppressed = false,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  suppressed?: boolean;
  /** Optional controlled open state (e.g. opened from a header/landing link). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in fixed footer trigger entirely. */
  hideTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const setIsOpen = (v: boolean) => {
    setUncontrolledOpen(v);
    onOpenChange?.(v);
  };
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [resultMsg, setResultMsg] = useState<{ text: string, type: 'success' | 'error' | 'neutral' | 'blocked' } | null>(null);

  const checkMutation = useCheckEligibility();

  const handleCheck = () => {
    if (!name || !phone) return;
    setResultMsg(null);
    checkMutation.mutate({ data: { name, phone } }, {
      onSuccess: (res) => {
        if (res.isBlocked || res.remaining === 0) {
          setResultMsg({ text: res.message, type: 'blocked' });
        } else if (!res.found) {
          setResultMsg({ text: res.message, type: 'neutral' });
        } else {
          setResultMsg({ text: res.message, type: 'success' });
        }
      },
      onError: () => {
        setResultMsg({ text: "Could not check eligibility right now.", type: 'error' });
      }
    });
  };

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      {/* Same viewport-fixed CTA container as the Landing "Find a session near me" footer.
          Removed entirely while this drawer or any other modal is open so it
          can't be seen, clicked, or focused behind the sheet. */}
      {!isOpen && !suppressed && !hideTrigger && (
        <footer className="fixed bottom-0 left-0 right-0 z-[1000] border-t border-[hsl(var(--border))] bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto w-full">
            <p className="text-[14px] font-normal text-foreground text-center mb-2">Already booked or completed a session?</p>
            <PrimaryCtaButton onClick={() => setIsOpen(true)}>Check remaining sessions</PrimaryCtaButton>
          </div>
        </footer>
      )}
      <DrawerContent className="max-w-[480px] mx-auto">
        <div className="w-full max-w-[448px] mx-auto">
          <DrawerHeader>
            <DrawerTitle>Check remaining sessions</DrawerTitle>
            <DrawerDescription>
              Enter your Instawork name and phone number to see how many sessions you can still book.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name on your Instawork account</Label>
              <Input 
                id="name" 
                placeholder="First and last name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="rounded-xl h-12 bg-white border-[hsl(var(--border))]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number on your Instawork account</Label>
              <Input 
                id="phone" 
                placeholder="(555) 123-4567" 
                type="tel" 
                value={phone} 
                onChange={e => setPhone(e.target.value)}
                className="rounded-xl h-12 bg-white border-[hsl(var(--border))]"
              />
            </div>

            {resultMsg && (
              <div className={`p-4 rounded-xl text-sm font-medium border ${
                resultMsg.type === 'success' ? 'bg-success/10 text-success border-success/20' : 
                resultMsg.type === 'error' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                resultMsg.type === 'blocked' ? 'bg-amber-50 text-amber-900 border-amber-200' :
                'bg-muted text-muted-foreground border-transparent'
              }`}>
                {resultMsg.text}
              </div>
            )}
          </div>
          <DrawerFooter className="pb-safe pt-2">
            <Button 
              className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-none"
              onClick={handleCheck}
              disabled={checkMutation.isPending || !name || !phone}
            >
              {checkMutation.isPending ? "Checking..." : "Check remaining sessions"}
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost" className="h-12 rounded-xl font-normal text-muted-foreground">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
