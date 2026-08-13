import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const APP_BENEFITS = [
  "Book sessions and manage your schedule in one place",
  "Get push notifications for new sessions",
  "View exact address and directions before you go",
  "Receive payment and track your earnings",
];

export default function GetApp() {
  useEffect(() => {
    trackEvent("get_app_page_viewed", {});
  }, []);

  const appStoreUrl = "https://apps.apple.com/us/app/instawork/id1234567890";
  const playStoreUrl = "https://play.google.com/store/apps/details?id=com.instawork.worker";

  return (
    <div className="flex-1 flex flex-col bg-background">
      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[640px] mx-auto px-5 md:px-12 pt-5 md:pt-10 pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Link href="/" className="inline-flex items-center mb-8 -ml-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>

          <div className="text-center mb-12">
            <h1 className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.15] font-bold tracking-tight text-[#11243e] mb-4">
              Download the Instawork app
            </h1>
            <p className="text-[16px] text-[#576270] leading-relaxed">
              Complete your booking and manage your sessions directly in the Instawork app.
            </p>
          </div>

          {/* App store badges */}
          <div className="space-y-4 mb-12">
            <a
              href={appStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("app_store_clicked", {})}
              className="block w-full"
            >
              <div className="bg-white border border-[#EEE9DD] rounded-[12px] p-4 hover:bg-[#FCFBF9] transition-colors duration-150 active:opacity-80">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-[#3351E6] rounded-[8px] flex items-center justify-center shrink-0">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.71 19.71a6 6 0 0 0 .89-.89l2.1-2.1a1 1 0 0 0-1.41-1.41l-2.1 2.1a4 4 0 0 1-.59.59M9 11a4 4 0 0 1 4-4 1 1 0 0 0 0-2 6 6 0 0 0-6 6 1 1 0 0 0 2 0 4 4 0 0 1 0-0Z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] text-[#8A8F9E] font-medium">Download on</p>
                    <p className="text-[18px] font-bold text-[#11243e]">App Store</p>
                  </div>
                </div>
              </div>
            </a>

            <a
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("google_play_clicked", {})}
              className="block w-full"
            >
              <div className="bg-white border border-[#EEE9DD] rounded-[12px] p-4 hover:bg-[#FCFBF9] transition-colors duration-150 active:opacity-80">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-[#3351E6] rounded-[8px] flex items-center justify-center shrink-0">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3.5 10.5l8-8 8 8M3.5 10.5v9c0 .5.5 1 1 1h15c.5 0 1-.5 1-1v-9M8 14h8m-6 4h4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] text-[#8A8F9E] font-medium">Get it on</p>
                    <p className="text-[18px] font-bold text-[#11243e]">Google Play</p>
                  </div>
                </div>
              </div>
            </a>
          </div>

          {/* Why use the app — plain quiet list, no filled panel. */}
          <div>
            <h2 className="text-[15px] font-semibold text-[#11243e] mb-4">Why download the app?</h2>
            <ul className="space-y-3">
              {APP_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex gap-2.5">
                  <Check className="w-4 h-4 text-[#3351E6] shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="text-[16px] text-[#576270]">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
