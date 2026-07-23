import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { Menu, X, ChevronDown, Globe } from "lucide-react";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { SIGNUP_FORM_URL } from "@/lib/constants";

const LOGO_URL = `${import.meta.env.BASE_URL}instawork_logo.png`;

function MenuAccordion({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-left text-[26px] leading-[1.12] font-bold tracking-tight text-gray-900 py-4"
      >
        <span>{label}</span>
        <ChevronDown
          className={`w-6 h-6 text-gray-900 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {open && <div className="pb-4 pr-8">{children}</div>}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const go = (path: string) => {
    setMenuOpen(false);
    setLocation(path);
  };

  const openEligibility = () => {
    setMenuOpen(false);
    setEligibilityOpen(true);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      <div className="w-full max-w-[480px] bg-card min-h-[100dvh] flex flex-col relative shadow-2xl shadow-black/5 ring-1 ring-border/50">
        {/* Shared app header */}
        <header className="sticky top-0 z-[1100] bg-[#294EB2] px-4 py-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => go("/")}
            className="flex items-center gap-2 min-w-0"
            aria-label="Instawork Research home"
          >
            <img src={LOGO_URL} alt="" className="w-9 h-9 rounded-[10px] shrink-0" />
            <span className="text-base font-bold leading-none whitespace-nowrap">
              <span className="text-white">Instawork</span>{" "}
              <span className="text-[#246BFD]">Research</span>
            </span>
          </button>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={openEligibility}
              className="text-base font-medium text-white"
            >
              Log in
            </button>
            <a
              href={SIGNUP_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white text-[#101828] text-base font-medium px-4 py-2 leading-none inline-flex items-center h-9"
            >
              Sign up
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="p-1 text-white"
            >
              <Menu className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>
        </header>

        {/* Full-screen menu */}
        {menuOpen && (
          <div className="fixed inset-0 z-[1200] flex justify-center bg-black/20">
            <div className="w-full max-w-[480px] bg-background min-h-[100dvh] flex flex-col">
              {/* Menu header — mirrors the app header with X in place of the hamburger */}
              <div className="bg-[#294EB2] px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={LOGO_URL} alt="" className="w-9 h-9 rounded-[10px] shrink-0" />
                  <span className="text-base font-bold leading-none whitespace-nowrap">
                    <span className="text-white">Instawork</span>{" "}
                    <span className="text-[#246BFD]">Research</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={openEligibility}
                    className="text-base font-medium text-white"
                  >
                    Log in
                  </button>
                  <a
                    href={SIGNUP_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-white text-[#101828] text-base font-medium px-4 py-2 leading-none inline-flex items-center h-9"
                  >
                    Sign up
                  </a>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close menu"
                    className="p-1 text-white"
                  >
                    <X className="w-6 h-6" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto flex flex-col px-6 pt-8 pb-6">
                <button
                  type="button"
                  onClick={() => go("/sessions")}
                  className="text-left text-[26px] leading-[1.12] font-bold tracking-tight text-gray-900 py-4"
                >
                  Find sessions
                </button>

                <MenuAccordion
                  label="How it works"
                  open={expandedItem === "how"}
                  onToggle={() => setExpandedItem(expandedItem === "how" ? null : "how")}
                >
                  <p className="text-base text-gray-600">
                    Book a session near you, visit the location, and complete simple
                    guided voice recording tasks. You're paid through Instawork after
                    your session.
                  </p>
                </MenuAccordion>

                <button
                  type="button"
                  onClick={() => go("/")}
                  className="text-left text-[26px] leading-[1.12] font-bold tracking-tight text-gray-900 py-4"
                >
                  Locations
                </button>

                <MenuAccordion
                  label="Eligibility"
                  open={expandedItem === "eligibility"}
                  onToggle={() =>
                    setExpandedItem(expandedItem === "eligibility" ? null : "eligibility")
                  }
                >
                  <p className="text-base text-gray-600">
                    You can book up to 3 sessions.{" "}
                    <button
                      type="button"
                      onClick={openEligibility}
                      className="text-primary underline underline-offset-2"
                    >
                      Check your remaining sessions
                    </button>
                    .
                  </p>
                </MenuAccordion>

                <MenuAccordion
                  label="FAQ"
                  open={expandedItem === "faq"}
                  onToggle={() => setExpandedItem(expandedItem === "faq" ? null : "faq")}
                >
                  <p className="text-base text-gray-600">
                    No experience is needed — we'll guide you through every step.
                    Sessions take about 3 hours and pay $66–$111 through Instawork.
                  </p>
                </MenuAccordion>

                <MenuAccordion
                  label="Help"
                  open={expandedItem === "help"}
                  onToggle={() => setExpandedItem(expandedItem === "help" ? null : "help")}
                >
                  <p className="text-base text-gray-600">
                    Questions about a booking? Reach out through your Instawork app, or
                    check your remaining sessions from the Eligibility section above.
                  </p>
                </MenuAccordion>

                <div className="flex items-center gap-2 mt-6 text-gray-900">
                  <Globe className="w-5 h-5" strokeWidth={1.75} />
                  <span className="text-base font-medium">EN</span>
                </div>
              </nav>
            </div>
          </div>
        )}

        {/* Eligibility drawer opened from "Log in" — trigger footer hidden */}
        <EligibilityCheckDrawer
          hideTrigger
          open={eligibilityOpen}
          onOpenChange={setEligibilityOpen}
        />

        {children}
      </div>
    </div>
  );
}
