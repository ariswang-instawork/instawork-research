import { useQuery, useQueryClient } from "@tanstack/react-query";

const base = import.meta.env.BASE_URL;
const RETURN_TO_KEY = "auth-return-to";

export type EligibilitySite = {
  businessId: number;
  siteLabel: string | null;
  cap: number;
  remaining: number;
  completedCount: number;
  bookedCount: number;
  isBlocked: boolean;
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
      if (!resp.ok) throw new Error(`eligibility ${resp.status}`);
      return resp.json();
    },
  });
}

/** Kick off the Instawork OAuth flow, remembering where the user was. */
export function login() {
  try {
    sessionStorage.setItem(
      RETURN_TO_KEY,
      window.location.pathname + window.location.search + window.location.hash,
    );
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
  if (params.get("auth") === "success" && returnTo && returnTo !== window.location.pathname) {
    window.history.replaceState(null, "", returnTo);
    // wouter listens for popstate/pushState via its own events; a soft reload
    // of routing state is triggered by dispatching popstate.
    window.dispatchEvent(new PopStateEvent("popstate"));
  } else {
    // Just strip the ?auth=... noise from the URL.
    params.delete("auth");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }
}

/** Log out and refresh auth-dependent queries. */
export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    try {
      await fetch(`${base}api/auth/logout`, { credentials: "include" });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["auth-status"] });
      queryClient.removeQueries({ queryKey: ["eligibility"] });
    }
  };
}
