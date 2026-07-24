import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { EligibilityCheckDrawer } from "@/components/Drawers";
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

  /** Navigate home (if needed) and scroll to a landing-page section. */
  const goSection = (id: string) => {
    closeMenu();
    setLocation("/");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
    );
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
    "text-[15px] font-medium text-[#101828] transition-opacity duration-150 hover:opacity-70 active:opacity-85";

  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      <div className="w-full bg-card min-h-[100dvh] flex flex-col relative">
        {/* Shared app header */}
        <header className="sticky top-0 z-[1100] bg-white border-b border-[#e4e7ec] h-[var(--header-height)] flex items-center">
          <div className="w-full max-w-[1200px] mx-auto px-5 md:px-12 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => go("/")}
              className="flex items-center gap-2 min-w-0"
              aria-label="Instawork Research home"
            >
              <img src={LOGO_URL} alt="" className="w-9 h-9 rounded-[10px] shrink-0" />
              <span className="text-xl font-bold leading-none whitespace-nowrap truncate min-w-0">
                <span className="text-black">Instawork</span>{" "}
                <span className="text-[#23409A]">Research</span>
              </span>
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6" aria-label="Main">
              <button type="button" onClick={findSessions} className={navLink}>
                Find sessions
              </button>
              <button type="button" onClick={() => goSection("how-it-works")} className={navLink}>
                How it works
              </button>
              <button type="button" onClick={() => goSection("faq")} className={navLink}>
                FAQ
              </button>
              <button type="button" onClick={handleAuthClick} className={navLink}>
                {isAuthenticated ? "Log out" : "Log in"}
              </button>
              <button
                type="button"
                onClick={findSessions}
                className="rounded-[12px] bg-[#23409A] text-white text-[15px] font-semibold px-5 h-11 inline-flex items-center transition-opacity duration-150 active:opacity-85"
              >
                View sessions
              </button>
            </nav>

            {/* Mobile: hamburger only */}
            <button
              type="button"
              onClick={toggleMenu}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="md:hidden p-1 text-[#101828]"
            >
              <HamburgerIcon open={menuOpen} />
            </button>
          </div>
        </header>

        {/* Mobile full-screen menu */}
        {menuMounted && (
          <div
            className={`fixed inset-0 z-[1200] flex justify-center bg-black/20 transition-opacity duration-200 md:hidden ${
              menuOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="w-full bg-background min-h-[100dvh] flex flex-col">
              {/* Menu header — mirrors the app header with X in place of the hamburger */}
              <div className="bg-white border-b border-[#e4e7ec] h-[var(--header-height)] shrink-0 flex items-center">
                <div className="w-full max-w-[1200px] mx-auto px-5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={LOGO_URL} alt="" className="w-9 h-9 rounded-[10px] shrink-0" />
                    <span className="text-xl font-bold leading-none whitespace-nowrap truncate min-w-0">
                      <span className="text-black">Instawork</span>{" "}
                      <span className="text-[#23409A]">Research</span>
                    </span>
                  </div>
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

              <nav
                aria-label="Mobile"
                className={`flex-1 overflow-y-auto flex flex-col px-6 pt-6 pb-6 transition-[opacity,transform] duration-200 ease-out ${
                  menuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                }`}
              >
                {[
                  { label: "Find sessions", action: findSessions },
                  { label: "How it works", action: () => goSection("how-it-works") },
                  { label: "Locations", action: () => go("/") },
                  { label: "FAQ", action: () => goSection("faq") },
                  {
                    label: isAuthenticated ? "Log out" : "Log in",
                    action: handleAuthClick,
                  },
                ].map(({ label, action }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    className="text-left text-[22px] leading-[1.15] font-bold tracking-tight text-gray-900 py-4 border-b border-[#eef0f3] transition-colors duration-150 active:bg-black/[0.06]"
                  >
                    {label}
                  </button>
                ))}
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
