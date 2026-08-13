import { useEffect } from "react";
import { useLocation } from "wouter";
import { EligibilityPanel } from "@/components/EligibilityPanel";
import { useAuthStatus, useMe, firstNameOf } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

export default function MySessions() {
  const [, setLocation] = useLocation();
  const { data: auth, isLoading: authLoading } = useAuthStatus();
  const isAuthenticated = !!auth?.authenticated;
  const { data: me } = useMe(isAuthenticated);
  const firstName = firstNameOf(me?.name);

  useEffect(() => {
    trackEvent("my_sessions_page_viewed", {});
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
      window.dispatchEvent(
        new CustomEvent("iw:login-required", { detail: { returnTo: "/my-sessions" } }),
      );
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FCFBF9]">
      <main className="flex-1 overflow-y-auto py-12 md:py-16 lg:py-20">
        <div className="max-w-[720px] mx-auto px-5 md:px-8 w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
          <h1 className="text-[32px] md:text-[40px] lg:text-[44px] leading-[1.1] font-bold tracking-tight text-[#11243e]">
            My sessions
          </h1>
          <p className="text-[16px] md:text-[17px] text-[#8A93A0] mt-2 mb-8 md:mb-10">
            {firstName ? `Welcome back, ${firstName}.` : "Based on your Instawork account."}
          </p>
          <EligibilityPanel />
        </div>
      </main>
    </div>
  );
}
