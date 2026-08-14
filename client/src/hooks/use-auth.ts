import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionItem } from "@/lib/api-client/generated/api.schemas";

const base = import.meta.env.BASE_URL;
const RETURN_TO_KEY = "auth-return-to";
const LOGGED_OUT_KEY = "iw:logged-out";

/** Mark that the user explicitly logged out (suppress auto re-login). */
export function markLoggedOut() {
  try {
    sessionStorage.setItem(LOGGED_OUT_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

/** True once after logout; clears the flag when read. */
export function consumeLoggedOut(): boolean {
  try {
    if (sessionStorage.getItem(LOGGED_OUT_KEY)) {
      sessionStorage.removeItem(LOGGED_OUT_KEY);
      return true;
    }
  } catch {
    /* storage unavailable */
  }
  return false;
}

export type EligibilitySite = {
  businessId: number;
  siteLabel: string | null;
  cap: number;
  remaining: number;
  completedCount: number;
  bookedCount: number;
  isBlocked: boolean;
  oneVisitLimit: boolean;
};

export type EligibilityResponse = {
  workerId: number;
  sites: EligibilitySite[];
};

/** Whether the current browser session is logged in via Instawork OAuth. */
export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: async (): Promise<{ authenticated: boolean }> => {
      const resp = await fetch(`${base}api/auth/status`, { credentials: "include" });
      if (!resp.ok) return { authenticated: false };
      return resp.json();
    },
    staleTime: 60 * 1000,
  });
}

/** The logged-in user's remaining sessions per site. 401 → not logged in. */
export function useEligibility(enabled: boolean) {
  return useQuery({
    queryKey: ["eligibility"],
    enabled,
    retry: false,
    queryFn: async (): Promise<EligibilityResponse> => {
      const resp = await fetch(`${base}api/eligibility`, { credentials: "include" });
      if (!resp.ok) {
        // The endpoint tags each failure with a `reason` so the drawer can say
        // which step broke instead of one catch-all message.
        const reason = await resp
          .json()
          .then((b) => (typeof b?.reason === "string" ? b.reason : null))
          .catch(() => null);
        throw new Error(reason ? `${resp.status}:${reason}` : `${resp.status}`);
      }
      return resp.json();
    },
  });
}

export type MeResponse = {
  workerId: number;
  name: string | null;
};

/** The logged-in user's Instawork identity (worker id + display name). */
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ["me"],
    enabled,
    retry: false,
    queryFn: async (): Promise<MeResponse> => {
      const resp = await fetch(`${base}api/me`, { credentials: "include" });
      if (!resp.ok) throw new Error(String(resp.status));
      return resp.json();
    },
  });
}

/** First name only, for greetings. Null when unavailable. */
export function firstNameOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const first = name.trim().split(/\s+/)[0];
  return first || null;
}

export type EligibilitySessionsResponse = {
  businessId: number;
  sessions: SessionItem[];
};

/** Open shifts for one eligible business/site. Lazy — only runs when enabled. */
export function useEligibilitySessions(businessId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ["eligibility-sessions", businessId],
    enabled: enabled && businessId != null,
    retry: false,
    queryFn: async (): Promise<EligibilitySessionsResponse> => {
      const resp = await fetch(`${base}api/eligibility/sessions?business=${businessId}`, {
        credentials: "include",
      });
      if (!resp.ok) throw new Error(String(resp.status));
      return resp.json();
    },
  });
}

/** Default post-login destination. */
export const DEFAULT_LOGIN_RETURN = "/my-sessions";

/** Kick off the Instawork OAuth flow, remembering where to return after auth. */
export function login(returnTo: string = DEFAULT_LOGIN_RETURN) {
  try {
    sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  } catch {
    /* storage unavailable — worst case the user lands on home */
  }
  window.location.href = `${base}api/auth/login`;
}

/**
 * Called once on app start: after the OAuth callback redirects to
 * "/?auth=success", send the user back to where they started the login.
 */
export function consumeAuthReturn() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("auth") && !params.has("error")) return;
  let returnTo: string | null = null;
  try {
    returnTo = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    /* ignore */
  }
  if (params.get("auth") === "success") {
    const destination =
      returnTo && returnTo !== "/" && returnTo !== window.location.pathname
        ? returnTo
        : DEFAULT_LOGIN_RETURN;
    if (destination !== window.location.pathname) {
      window.history.replaceState(null, "", destination);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else {
      params.delete("auth");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
      );
    }
    return;
  }
}

/** Log out and refresh auth-dependent queries. */
export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    markLoggedOut();
    try {
      await fetch(`${base}api/auth/logout`, { credentials: "include" });
    } finally {
      queryClient.setQueryData(["auth-status"], { authenticated: false });
      queryClient.removeQueries({ queryKey: ["eligibility"] });
      queryClient.removeQueries({ queryKey: ["me"] });
      queryClient.removeQueries({ queryKey: ["eligibility-sessions"] });
    }
  };
}
