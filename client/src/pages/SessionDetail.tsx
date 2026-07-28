import { useState } from "react";
import { ArrowLeft, Calendar, CreditCard, MapPin, Mic } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useGetSessionById, getGetSessionByIdQueryKey } from "@/lib/api-client";
import { useSiteStorage } from "@/hooks/use-site";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ContinueWithInstaworkSheet } from "@/components/ContinueWithInstaworkSheet";
import { PrimaryCtaButton } from "@/components/PrimaryCtaButton";
import { EXCLUDED_STATES, SESSION_CAP } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";

export default function SessionDetail() {
  const [, params] = useRoute("/sessions/:id");
  const id = params?.id;
  const { site } = useSiteStorage();
  const [bookSheetOpen, setBookSheetOpen] = useState(false);

  const { data: session, isLoading } = useGetSessionById(id || "", { 
    query: { enabled: !!id, queryKey: getGetSessionByIdQueryKey(id || "") } 
  });

  const excludedStatesText = EXCLUDED_STATES.slice(0, -1).join(", ") + ", or " + EXCLUDED_STATES[EXCLUDED_STATES.length - 1];

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <div className="px-6 pt-5 pb-10 space-y-6 max-w-md mx-auto w-full">
          <Skeleton className="w-10 h-10 rounded-full bg-muted" />
          <Skeleton className="w-24 h-5 rounded bg-muted" />
          <Skeleton className="w-3/4 h-8 bg-muted" />
          <Skeleton className="w-1/2 h-5 bg-muted" />
          <Skeleton className="h-[100px] rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4">
        <h1 className="text-xl font-bold">Session not found</h1>
        <Link href="/">
          <Button variant="outline">Go back</Button>
        </Link>
      </div>
    );
  }

  const analyticsProps = {
    session_id: session.id,
    location: session.label || null,
    date: session.dateISO || session.date || null,
    source_page: "session_detail",
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      <main className="flex-1 overflow-y-auto px-5 md:px-6">
        <div className="max-w-md md:max-w-2xl mx-auto w-full pt-5 md:pt-10 pb-40 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Link href="/" className="inline-flex items-center mb-6 -ml-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>

          <div className="md:bg-card md:border md:border-[hsl(var(--border))] md:rounded-[20px] md:shadow-[0_5px_20px_0_rgba(0,0,0,0.08)] md:p-10">
            {/* Header — title + location on the left, compact earnings pill on the right. */}
            <div className="flex items-end justify-between gap-4 mb-8">
              <div className="min-w-0">
                <h1 className="text-[32px] font-bold tracking-tight mb-2 leading-tight">Paid Research Participant</h1>
                <p className="text-[14px] text-muted-foreground leading-snug">{session.label}</p>
                {site?.origin && (
                  <p className="text-[14px] text-muted-foreground mt-1">{site.origin.distanceMiles} miles away</p>
                )}
              </div>
              <div className="shrink-0 text-center">
                <div className="inline-block rounded-[10px] border border-[hsl(var(--border))] bg-card px-4 py-2 text-[16px] font-bold shadow-sm">
                  {session.payLabel || "$72"}
                </div>
                <p className="text-[13px] font-medium text-muted-foreground mt-1">Estimated pay</p>
                {session.payRateUsd != null && session.billableHours != null && (
                  <p className="text-[13px] text-muted-foreground mt-1 whitespace-nowrap">
                    ${Number.isInteger(session.payRateUsd) ? session.payRateUsd : session.payRateUsd.toFixed(2)}/hr × {session.billableHours} hours
                  </p>
                )}
              </div>
            </div>

            {/* Details card — one rounded card, icon sections with thin dividers. */}
            <div className="mb-8">
              <div className="flex items-start gap-3.5 py-5 border-b border-[hsl(var(--border))]">
                <Calendar className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-[17px] font-bold text-foreground">{session.date}{session.dateISO ? `, ${session.dateISO.slice(0, 4)}` : ""}</p>
                  <p className="text-[16px] text-muted-foreground mt-2">{session.time} (3 hours)</p>
                </div>
              </div>
              {session.label && (
                <div className="flex items-start gap-3.5 py-5 border-b border-[hsl(var(--border))]">
                  <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold text-foreground">Location</p>
                    <p className="text-[16px] text-muted-foreground leading-relaxed mt-2">{session.label}</p>
                    {site?.origin && (
                      <p className="text-[14px] text-muted-foreground mt-1">{site.origin.distanceMiles} miles away</p>
                    )}
                    <p className="text-[13px] text-[#8A8F9E] mt-3">
                      Exact address is provided after you book in the Instawork app.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3.5 py-5 border-b border-[hsl(var(--border))]">
                <Mic className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-[17px] font-bold text-foreground">What you'll do</p>
                  <p className="text-[16px] text-muted-foreground mt-2">Complete simple voice recording tasks to help improve AI technology.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 py-5">
                <CreditCard className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-[17px] font-bold text-foreground">Payment</p>
                  <p className="text-[16px] text-muted-foreground mt-2">You'll be paid through Instawork after your session.</p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-[18px] font-semibold mb-3">Important to know</h3>
              <ul className="space-y-1.5 pl-5 list-disc text-[15px] text-[hsl(var(--body-muted))] leading-relaxed">
                <li>Arrive on time</li>
                <li>Bring a valid photo ID</li>
                <li>Check your email for a follow-up form before your session</li>
                <li>Not available to residents of {excludedStatesText}</li>
              </ul>
            </div>

            {/* How booking works — numbered rows; only step 1 is interactive. */}
            <div>
              <h3 className="text-[18px] font-semibold mb-2">How booking works</h3>
              <div className="flex items-start gap-3.5 py-5 border-b border-[hsl(var(--border))]">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div className="min-w-0">
                  <p className="text-[17px] font-bold text-foreground">Continue in the Instawork app</p>
                  <p className="text-[15px] text-[hsl(var(--body-muted))] leading-relaxed mt-2">Open the selected shift in the Instawork app.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 py-5 border-b border-[hsl(var(--border))]">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div className="min-w-0">
                  <p className="text-[17px] font-bold text-foreground">Complete the sign-up form</p>
                  <p className="text-[15px] text-[hsl(var(--body-muted))] leading-relaxed mt-2">Complete the sign-up form in the Instawork app.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 py-5">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <div className="min-w-0">
                  <p className="text-[17px] font-bold text-foreground">Book your session</p>
                  <p className="text-[15px] text-[hsl(var(--body-muted))] leading-relaxed mt-2">Reserve your recording session.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-[hsl(var(--border))] px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-20">
        <div className="max-w-md md:max-w-2xl mx-auto w-full flex flex-col gap-2.5">
          <PrimaryCtaButton
            onClick={() => {
              trackEvent("book_cta_clicked", analyticsProps);
              setBookSheetOpen(true);
              trackEvent("account_choice_modal_opened", analyticsProps);
            }}
          >
            Book in the Instawork app
          </PrimaryCtaButton>
        </div>
      </div>

      <ContinueWithInstaworkSheet
        open={bookSheetOpen}
        onOpenChange={setBookSheetOpen}
        bookUrl={session.bookUrl}
        analyticsProps={analyticsProps}
      />
    </div>
  );
}
