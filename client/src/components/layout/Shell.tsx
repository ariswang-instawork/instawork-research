import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ChevronDown, Globe } from "lucide-react";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { SIGNUP_FORM_URL } from "@/lib/constants";
import { useAuthStatus, useLogout, login } from "@/hooks/use-auth";

const LOGO_URL = `${import.meta.env.BASE_URL}instawork_logo_white_background.png`;

/** Hamburger that morphs into an X (top/bottom rotate, middle fades). */
function HamburgerIcon({ open }: { open: boolean }) {
  const bar = "absolute left-0 right-0 h-[2px] rounded-full bg-current transition-all duration-200 ease-out";
  return (
    <span className="relative block w-6 h-6" aria-hidden="true">
      <span className={`${bar} ${open ? "top-[11px] rotate-45" : "top-[5px]"}`} />
      <span className={`${bar} top-[11px] ${open ? "opacity-0" : "opacity-100"}`} />
      <span className={`${bar} ${open ? "top-[11px] -rotate-45" : "top-[17px]"}`} />
    </span>
  );
}

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
        className="w-full flex items-center justify-between text-left text-[26px] leading-[1.12] font-bold tracking-tight text-gray-900 py-4 rounded-lg transition-colors duration-150 active:bg-black/[0.06]"
      >
        <span>{label}</span>
        <ChevronDown
          className={`w-6 h-6 text-gray-900 shrink-0 transition-transform duration-[250ms] ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {/* Height + opacity animate via the grid-rows trick (content stays mounted). */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-[250ms] ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-4 pr-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  // menuMounted keeps the panel in the DOM during the close animation;
  // menuOpen drives the open/closed visual state.
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  // "How it works" starts expanded on first open.
  const [expandedItem, setExpandedItem] = useState<string | null>("how");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuMounted(true);
    // Two rAFs so the panel paints in its hidden state before transitioning.
    requestAnimationFrame(() => requestAnimationFrame(() => setMenuOpen(true)));
  };

  const closeMenu = () => {
    setMenuOpen(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenuMounted(false), 250);
  };

  const toggleMenu = () => (menuOpen ? closeMenu() : openMenu());

  // Lock body scroll while the menu is open.
  useEffect(() => {
    if (!menuMounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuMounted]);

  const go = (path: string) => {
    closeMenu();
    setLocation(path);
  };

  const openEligibility = () => {
    closeMenu();
    setEligibilityOpen(true);
  };

  const { data: auth } = useAuthStatus();
  const isAuthenticated = !!auth?.authenticated;
  const logout = useLogout();

  // "Log in" starts the Instawork OAuth flow (returning here afterwards);
  // "Log out" ends the session.
  const handleAuthClick = () => {
    closeMenu();
    if (isAuthenticated) void logout();
    else login();
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      <div className="w-full bg-card min-h-[100dvh] flex flex-col relative">
        {/* Shared app header */}
        <header className="sticky top-0 z-[1100] bg-white border-b border-[#e4e7ec] h-16 md:h-[72px] flex items-center">
          <div className="w-full max-w-[1120px] mx-auto px-5 md:px-12 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => go("/")}
            className="flex items-center gap-2 min-w-0"
            aria-label="Instawork Research home"
          >
            <img src={LOGO_URL} alt="" className="w-9 h-9 rounded-[10px] shrink-0" />
            <span className="text-xl font-bold leading-none whitespace-nowrap truncate min-w-0">
              <span className="text-black">Instawork</span>{" "}
              <span className="text-[#1c387d]">Research</span>
            </span>
          </button>

          <div className="flex items-center gap-3 shrink-0">
            {/* Log in / Sign up live in the menu panel below md to avoid
                overlapping the wordmark on narrow screens. */}
            <button
              type="button"
              onClick={handleAuthClick}
              className="hidden md:block text-base font-medium text-[#101828] transition-opacity duration-150 active:opacity-85"
            >
              {isAuthenticated ? "Log out" : "Log in"}
            </button>
            <a
              href={SIGNUP_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex rounded-full bg-[#1c387d] text-white text-base font-medium px-4 py-2 leading-none items-center h-9 transition-opacity duration-150 active:opacity-85"
            >
              Sign up
            </a>
            <button
              type="button"
              onClick={toggleMenu}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="p-1 text-[#101828]"
            >
              <HamburgerIcon open={menuOpen} />
            </button>
          </div>
          </div>
        </header>

        {/* Full-screen menu */}
        {menuMounted && (
          <div
            className={`fixed inset-0 z-[1200] flex justify-center bg-black/20 transition-opacity duration-200 ${
              menuOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="w-full bg-background min-h-[100dvh] flex flex-col">
              {/* Menu header — mirrors the app header with X in place of the hamburger */}
              <div className="bg-white border-b border-[#e4e7ec] h-16 md:h-[72px] shrink-0 flex items-center">
              <div className="w-full max-w-[1120px] mx-auto px-5 md:px-12 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={LOGO_URL} alt="" className="w-9 h-9 rounded-[10px] shrink-0" />
                  <span className="text-xl font-bold leading-none whitespace-nowrap truncate min-w-0">
                    <span className="text-black">Instawork</span>{" "}
                    <span className="text-[#1c387d]">Research</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleAuthClick}
                    className="text-base font-medium text-[#101828] transition-opacity duration-150 active:opacity-85"
                  >
                    {isAuthenticated ? "Log out" : "Log in"}
                  </button>
                  <a
                    href={SIGNUP_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-[#1c387d] text-white text-base font-medium px-4 py-2 leading-none inline-flex items-center h-9 transition-opacity duration-150 active:opacity-85"
                  >
                    Sign up
                  </a>
                  <button
                    type="button"
                    onClick={closeMenu}
                    aria-label="Close menu"
                    aria-expanded={menuOpen}
                    className="p-1 text-[#101828]"
                  >
                    <HamburgerIcon open={menuOpen} />
                  </button>
                </div>
              </div>
              </div>

              <nav
                className={`flex-1 overflow-y-auto flex flex-col px-6 pt-8 pb-6 transition-[opacity,transform] duration-200 ease-out ${
                  menuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("iw_sessions_expanded", "1");
                    go("/");
                    window.dispatchEvent(new CustomEvent("iw:view-sessions"));
                  }}
                  className="text-left text-[26px] leading-[1.12] font-bold tracking-tight text-gray-900 py-4 rounded-lg transition-colors duration-150 active:bg-black/[0.06]"
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
                  className="text-left text-[26px] leading-[1.12] font-bold tracking-tight text-gray-900 py-4 rounded-lg transition-colors duration-150 active:bg-black/[0.06]"
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
                    You must have an Instawork account.{" "}
                    <button
                      type="button"
                      onClick={openEligibility}
                      className="text-primary underline underline-offset-2"
                    >
                      Log in
                    </button>{" "}
                    to see how many sessions you can still book at each location.
                  </p>
                </MenuAccordion>

                <MenuAccordion
                  label="FAQ"
                  open={expandedItem === "faq"}
                  onToggle={() => setExpandedItem(expandedItem === "faq" ? null : "faq")}
                >
                  <p className="text-base text-gray-600">
                    Sessions are about 3 hours. Pay is shown before you book. You'll
                    need a valid ID at the location.
                  </p>
                </MenuAccordion>

                <MenuAccordion
                  label="Help"
                  open={expandedItem === "help"}
                  onToggle={() => setExpandedItem(expandedItem === "help" ? null : "help")}
                >
                  <p className="text-base text-gray-600">
                    Questions? Log in with your Instawork account or sign up to get
                    started.
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
