import { ArrowLeft, Calendar, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useGetSessions } from "@/lib/api-client";
import { useSiteStorage, type SiteOrigin } from "@/hooks/use-site";
import { LocationDrawer, EligibilityCheckDrawer } from "@/components/Drawers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_SITE, SESSION_CAP } from "@/lib/constants";

export default function Sessions() {
  const { site, setSite } = useSiteStorage();
  const [, setLocation] = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const displaySite = site || DEFAULT_SITE;
  const { data, isLoading } = useGetSessions({ site: displaySite.key });

  const handleSiteSelected = (key: string, label: string, origin?: SiteOrigin) => {
    setSite(key, label, origin);
    setIsDrawerOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <main className="flex-1 px-6 pt-5 pb-[calc(10rem+env(safe-area-inset-bottom))] overflow-y-auto max-w-md mx-auto w-full">
        <Link href="/" className="inline-flex items-center mb-3 -ml-1">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>

        <h1 className="text-[32px] font-bold tracking-tight mb-1 leading-tight">Available sessions</h1>
        
        <div className="mb-6">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="text-[14px] text-muted-foreground font-normal hover:text-foreground transition-colors"
          >
            {displaySite.label}
            {site?.origin ? ` · ${site.origin.distanceMiles} miles away` : ""}
          </button>
          {site?.origin && (
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              Showing sessions near {site.origin.label}{" "}
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="text-primary hover:underline"
              >
                Change location
              </button>
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between py-[18px] border-b border-[hsl(var(--border))] animate-pulse">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32 bg-muted" />
                  <Skeleton className="h-4 w-24 bg-muted" />
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <Skeleton className="h-5 w-12 bg-muted" />
                  <Skeleton className="h-8 w-16 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.sessions || data.sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-foreground">No sessions available</h3>
            <p className="text-muted-foreground text-sm max-w-[240px]">
              Check back soon for new openings.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-0 animate-in fade-in slide-in-from-bottom-3 duration-500">
              {data.sessions.map((session, index) => (
                // The whole card is one focusable button — the "View details"
                // pill inside is purely visual so there is a single
                // navigation path to the details page.
                <div
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setLocation(`/sessions/${session.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLocation(`/sessions/${session.id}`);
                    }
                  }}
                  className="flex items-center justify-between py-[18px] border-b border-[hsl(var(--border))] cursor-pointer hover:bg-muted/40 active:opacity-60 transition-[background-color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[16px] mb-0.5">{session.date}</div>
                    <div className="text-muted-foreground text-[13px]">{session.time}</div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-bold text-[15px]">{session.payLabel || "$72"}</span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-5">
              Up to {SESSION_CAP} sessions per person. Full address shown on every listing.
            </p>
          </>
        )}
      </main>

      <EligibilityCheckDrawer suppressed={isDrawerOpen} />

      <LocationDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onSiteSelected={handleSiteSelected}
      />
    </div>
  );
}
