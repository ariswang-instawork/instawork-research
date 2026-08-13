import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { EligibilityPanel } from "@/components/EligibilityPanel";
import { useAuthStatus } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

export default function MySessions() {
  const [, setLocation] = useLocation();
  const { data: auth, isLoading: authLoading } = useAuthStatus();
  const isAuthenticated = !!auth?.authenticated;

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
      <main className="flex-1 overflow-y-auto py-10 md:py-16 lg:py-20">
        <div className="max-w-[1200px] mx-auto px-5 md:px-12 w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-6 text-[15px] md:text-[16px] font-medium text-[#576270] hover:text-[#11243e] transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to home
          </Link>
          <h1 className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
            Your sessions
          </h1>
          <p className="text-[16px] text-[#576270] mt-1.5 mb-8 md:mb-10">
            Based on your Instawork account.
          </p>
          <EligibilityPanel />
        </div>
      </main>
    </div>
  );
}
