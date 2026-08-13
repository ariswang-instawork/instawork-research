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
    <div className="flex-1 flex flex-col bg-background">
      <main className="flex-1 overflow-y-auto px-5 md:px-6">
        <div className="max-w-md md:max-w-2xl mx-auto w-full pt-5 md:pt-10 pb-24 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Link href="/" className="inline-flex items-center mb-6 -ml-1" aria-label="Back to home">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#11243e]">
            Your sessions
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1.5 mb-6">
            Based on your Instawork account.
          </p>
          <EligibilityPanel />
        </div>
      </main>
    </div>
  );
}
