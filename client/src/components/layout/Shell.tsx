import { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      <div className="w-full max-w-[480px] bg-card min-h-[100dvh] flex flex-col relative shadow-2xl shadow-black/5 ring-1 ring-border/50">
        {children}
      </div>
    </div>
  );
}
