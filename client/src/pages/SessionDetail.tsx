import { useState } from "react";
import { Calendar, CreditCard, Info, MapPin, Mic } from "lucide-react";
import { useRoute, Link } from "wouter";
import { BackLink } from "@/components/BackLink";
import { useGetSessionById, getGetSessionByIdQueryKey } from "@/lib/api-client";
import { useAuthStatus } from "@/hooks/use-auth";
import { useSiteStorage } from "@/hooks/use-site";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ContinueWithInstaworkSheet } from "@/components/ContinueWithInstaworkSheet";
import { PrimaryCtaButton } from "@/components/PrimaryCtaButton";
import { EXCLUDED_STATES } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";

const BOOKING_STEPS = [
  { title: "Open the shift in Instawork", body: "Tap the button below to open the selected shift in the Instawork app." },
  { title: "Complete the sign-up form", body: "Fill out the short sign-up form on the shift page." },
  { title: "Book your session", body: "Tap Book shift to reserve your recording session." },
];

export default function SessionDetail() {
  const [, params] = useRoute("/sessions/:id");
  const id = params?.id;
  const { site } = useSiteStorage();
  const [bookSheetOpen, setBookSheetOpen] = useState(false);
  const { data: auth, isLoading: authLoading } = useAuthStatus();

  const { data: session, isLoading } = useGetSessionById(id || "", {
    query: { enabled: !!id, queryKey: getGetSessionByIdQueryKey(id || "") },
  });

  const isAuthenticated = !!auth?.authenticated;

  const excludedStatesText =
    EXCLUDED_STATES.slice(0, -1).join(", ") + ", or " + EXCLUDED_STATES[EXCLUDED_STATES.length - 1];

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col bg-[#FCFBF9]">
        <div className="max-w-[720px] mx-auto px-5 md:px-8 pt-10 md:pt-14 pb-10 space-y-6 w-full">
          <Skeleton className="w-24 h-5 rounded bg-muted" />
          <Skeleton className="w-3/4 h-10 bg-muted" />
          <Skeleton className="w-1/2 h-5 bg-muted" />
          <Skeleton className="h-[160px] rounded-[14px] bg-muted" />
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
    <div className="flex-1 flex flex-col bg-[#FCFBF9]">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-5 md:px-8 pt-10 md:pt-14 pb-40 w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
          <BackLink href="/" label="Sessions" />

          {/* Header — title + location, estimated-pay pill beneath. */}
          <h1 className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.15] font-bold tracking-tight text-[#11243e]">
            Paid Research Participant
          </h1>
          <p className="text-[16px] text-[#576270] mt-1.5">
            {session.label}
            {site?.origin && ` · ${site.origin.distanceMiles} miles away`}
          </p>

          <div className="inline-flex items-center gap-3 mt-4 rounded-[10px] bg-[#3351E6]/[0.06] px-4 py-2.5">
            <span className="text-[16px] font-bold text-[#11243e]">
              {session.payLabel || "$72"}
            </span>
            <span className="text-[13px] text-[#8A93A0]">estimated pay</span>
            {session.payRateUsd != null && session.billableHours != null && (
              <span className="text-[13px] text-[#8A93A0]">
                · ${Number.isInteger(session.payRateUsd) ? session.payRateUsd : session.payRateUsd.toFixed(2)}
                /hr × {session.billableHours}h
              </span>
            )}
          </div>

          {/* Detail rows — quiet grouped hairline list. */}
          <div className="mt-8 rounded-[14px] border border-[#EEE9DD] bg-white overflow-hidden divide-y divide-[#EEE9DD]">
            <div className="flex items-start gap-3.5 px-5 py-4 md:py-5">
              <Calendar className="w-5 h-5 text-[#8A93A0] shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-[#11243e]">
                  {session.date}
                  {session.dateISO ? `, ${session.dateISO.slice(0, 4)}` : ""}
                </p>
                <p className="text-[15px] text-[#8A93A0] mt-1">{session.time} (3 hours)</p>
              </div>
            </div>
            {session.label && (
              <div className="flex items-start gap-3.5 px-5 py-4 md:py-5">
                <MapPin className="w-5 h-5 text-[#8A93A0] shrink-0 mt-0.5" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold text-[#11243e]">Location</p>
                  <p className="text-[15px] text-[#8A93A0] mt-1 leading-relaxed">{session.label}</p>
                  {site?.origin && (
                    <p className="text-[13px] text-[#8A93A0] mt-0.5">
                      {site.origin.distanceMiles} miles away
                    </p>
                  )}
                  <p className="text-[13px] text-[#8A93A0] mt-2">
                    Exact address is provided after you book in the Instawork app.
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3.5 px-5 py-4 md:py-5">
              <Mic className="w-5 h-5 text-[#8A93A0] shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-[#11243e]">What you'll do</p>
                <p className="text-[15px] text-[#8A93A0] mt-1">
                  Complete simple voice recording tasks to help improve AI technology.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5 px-5 py-4 md:py-5">
              <CreditCard className="w-5 h-5 text-[#8A93A0] shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-[#11243e]">Payment</p>
                <p className="text-[15px] text-[#8A93A0] mt-1">
                  You'll be paid through Instawork after your session.
                </p>
              </div>
            </div>
          </div>

          {/* Important to know — one quiet note, not a bulleted box. */}
          <p className="flex items-start gap-2 text-[14px] md:text-[15px] text-[#8A93A0] leading-relaxed mt-6">
            <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Arrive on time with a valid photo ID. Check your email for a follow-up form before
              your session. Not available to residents of {excludedStatesText}.
            </span>
          </p>

          <div className="mt-8">
            <h3 className="text-[20px] md:text-[24px] font-bold tracking-tight text-[#11243e] mb-2">
              How booking works
            </h3>
            <div className="divide-y divide-[#EEE9DD]">
              {BOOKING_STEPS.map((step, i) => (
                <div key={step.title} className="flex items-start gap-3.5 py-4 md:py-5">
                  <span className="w-7 h-7 rounded-full bg-[#3351E6]/10 text-[#3351E6] text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[18px] md:text-[20px] font-semibold text-[#11243e]">{step.title}</p>
                    <p className="text-[16px] md:text-[17px] text-[#8A93A0] mt-1.5 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {!authLoading && (
      <div className="fixed bottom-0 left-0 right-0 bg-[#FCFBF9] border-t border-[#EEE9DD] px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-20">
        <div className="max-w-[720px] mx-auto px-0 md:px-3 w-full flex flex-col gap-2.5">
          <PrimaryCtaButton
            onClick={() => {
              trackEvent("book_cta_clicked", analyticsProps);
              if (isAuthenticated && session.bookUrl) {
                trackEvent("instawork_redirect_started", { ...analyticsProps, destination: "shift" });
                window.location.href = session.bookUrl;
                return;
              }
              setBookSheetOpen(true);
              trackEvent("account_choice_modal_opened", analyticsProps);
            }}
          >
            Open shift in Instawork
          </PrimaryCtaButton>
        </div>
      </div>
      )}

      <ContinueWithInstaworkSheet
        open={bookSheetOpen}
        onOpenChange={setBookSheetOpen}
        bookUrl={session.bookUrl}
        analyticsProps={analyticsProps}
      />
    </div>
  );
}
