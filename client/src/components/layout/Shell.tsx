import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { EligibilityCheckDrawer } from "@/components/Drawers";
import { useAuthStatus, useLogout, login } from "@/hooks/use-auth";

const LOGO_URL = `${import.meta.env.BASE_URL}iw-logo.svg`;

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

export function Shell({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  // menuMounted keeps the panel in the DOM during the close animation;
  // menuOpen drives the open/closed visual state.
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
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

  const findSessions = () => {
    closeMenu();
    setLocation("/");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("iw:view-sessions"))),
    );
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

  const navLink =
    "text-[15px] font-medium text-[#11243e] transition-opacity duration-150 hover:opacity-70 active:opacity-85";

  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      <div className="w-full bg-card min-h-[100dvh] flex flex-col relative">
        {/* Shared app header — mirrors instawork.com/worker's navbar: warm-paper
            background, bare logo mark (no chip), navy wordmark, tan hairline,
            gradient primary action. */}
        <header className="sticky top-0 z-[1100] bg-background border-b border-[#EEE9DD] h-16 md:h-20 flex items-center">
          <div className="w-full max-w-[1200px] mx-auto px-5 md:px-12 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => go("/")}
              className="flex items-center min-w-0"
              aria-label="Instawork Research home"
            >
              <img src={LOGO_URL} alt="Instawork" className="h-[26px] w-auto shrink-0" />
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6" aria-label="Main">
              <button type="button" onClick={handleAuthClick} className={navLink}>
                {isAuthenticated ? "Log out" : "Log in"}
              </button>
              <button
                type="button"
                onClick={findSessions}
                className="bg-cta-gradient rounded-[8px] text-white text-[15px] font-semibold px-5 h-11 inline-flex items-center transition-[filter] duration-150 hover:brightness-105 active:brightness-95"
              >
                Book sessions near me
              </button>
            </nav>

            {/* Mobile: hamburger only */}
            <button
              type="button"
              onClick={toggleMenu}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="md:hidden p-1 text-[#3351E6]"
            >
              <HamburgerIcon open={menuOpen} />
            </button>
          </div>
        </header>

        {/* Mobile full-screen menu — mirrors instawork.com's mobile nav sheet:
            light header strip, then a full-bleed dark navy gradient panel
            with white nav links and outline action buttons. */}
        {menuMounted && (
          <div
            className={`fixed inset-0 z-[1200] flex justify-center transition-opacity duration-200 md:hidden ${
              menuOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="w-full h-full flex flex-col">
              {/* Menu header — mirrors the app header with X in place of the hamburger */}
              <div className="bg-background border-b border-[#EEE9DD] h-16 shrink-0 flex items-center">
                <div className="w-full max-w-[1200px] mx-auto px-5 flex items-center justify-between gap-2">
                  <div className="flex items-center min-w-0">
                    <img src={LOGO_URL} alt="Instawork" className="h-[26px] w-auto shrink-0" />
                  </div>
                  <button
                    type="button"
                    onClick={closeMenu}
                    aria-label="Close menu"
                    aria-expanded={menuOpen}
                    className="p-1 text-[#3351E6]"
                  >
                    <HamburgerIcon open={menuOpen} />
                  </button>
                </div>
              </div>

              <div
                className={`flex-1 overflow-y-auto flex flex-col transition-[opacity,transform] duration-200 ease-out ${
                  menuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                }`}
                style={{ backgroundImage: "linear-gradient(180deg, #1c2942 0%, #05070d 100%)" }}
              >
                <nav aria-label="Mobile" className="flex flex-col px-6 pt-4">
                  {[
                    { label: "Find sessions", action: findSessions },
                    { label: "Locations", action: () => go("/") },
                  ].map(({ label, action }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      className="text-left text-[20px] leading-[1.15] font-semibold text-white py-4 border-b border-white/15 transition-colors duration-150 active:bg-white/5"
                    >
                      {label}
                    </button>
                  ))}
                </nav>

                <div className="mt-auto px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))] flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleAuthClick}
                    className="w-full h-12 rounded-[10px] border border-white/70 text-white text-[16px] font-semibold transition-colors duration-150 active:bg-white/10"
                  >
                    {isAuthenticated ? "Log out" : "Log in"}
                  </button>
                  <button
                    type="button"
                    onClick={findSessions}
                    className="w-full h-12 rounded-[10px] border border-white/70 text-white text-[16px] font-semibold transition-colors duration-150 active:bg-white/10"
                  >
                    Book sessions near me
                  </button>
                </div>
              </div>
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
