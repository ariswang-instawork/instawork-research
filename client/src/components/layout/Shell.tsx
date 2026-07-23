import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { SIGNUP_FORM_URL } from "@/lib/constants";

const LOGO_URL = `${import.meta.env.BASE_URL}instawork_logo.png`;

export function Shell({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [eligibilityOpen, setEligibilityOpen] = useState(false);

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
        <header className="sticky top-0 z-[1100] bg-card border-b border-[hsl(var(--border))] px-4 py-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => go("/")}
            className="flex items-center gap-2 min-w-0"
            aria-label="Instawork Research home"
          >
            <img src={LOGO_URL} alt="" className="w-9 h-9 rounded-[10px] shrink-0" />
            <span className="text-base font-bold leading-none whitespace-nowrap">
              <span className="text-gray-900">Instawork</span>{" "}
              <span className="text-primary">Research</span>
            </span>
          </button>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={openEligibility}
              className="text-base font-medium text-gray-900"
            >
              Log in
            </button>
            <a
              href={SIGNUP_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-primary text-white text-base font-medium px-4 py-2 leading-none inline-flex items-center h-9"
            >
              Sign up
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="p-1 text-gray-900"
            >
              <Menu className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>
        </header>

        {/* Full-screen menu */}
        {menuOpen && (
          <div className="fixed inset-0 z-[1200] flex justify-center bg-black/20">
            <div className="w-full max-w-[480px] bg-card min-h-[100dvh] flex flex-col">
              <div className="px-4 py-3 flex items-center justify-between border-b border-[hsl(var(--border))]">
                <span className="text-base font-bold leading-none">
                  <span className="text-gray-900">Instawork</span>{" "}
                  <span className="text-primary">Research</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1 text-gray-900"
                >
                  <X className="w-6 h-6" strokeWidth={2} />
                </button>
              </div>
              <nav className="flex flex-col px-6 py-6 gap-1">
                <button
                  type="button"
                  onClick={() => go("/")}
                  className="text-left text-base font-bold text-gray-900 py-3 border-b border-[hsl(var(--border))]"
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => go("/sessions")}
                  className="text-left text-base font-bold text-gray-900 py-3 border-b border-[hsl(var(--border))]"
                >
                  Browse sessions
                </button>
                <button
                  type="button"
                  onClick={openEligibility}
                  className="text-left text-base font-bold text-gray-900 py-3 border-b border-[hsl(var(--border))]"
                >
                  Check remaining sessions
                </button>
                <a
                  href={SIGNUP_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="text-left text-base font-bold text-primary py-3"
                >
                  Sign up
                </a>
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
