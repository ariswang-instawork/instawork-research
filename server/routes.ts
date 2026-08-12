import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { randomBytes, createHash } from "crypto";
import { registerApiRoutes } from "./apiRoutes";
import { prisma } from "./db";
import { resolveInstaworkUser } from "./instaworkUser";
import { getLifetimeCap } from "./siteCaps";
import { getServableRows, sanitizeLabel } from "./serving";

const INSTAWORK_BASE_URL = process.env.INSTAWORK_BASE_URL || "http://localhost:8080";
const INSTAWORK_CLIENT_ID = process.env.INSTAWORK_CLIENT_ID!;
const INSTAWORK_CLIENT_SECRET = process.env.INSTAWORK_CLIENT_SECRET!;

declare module "express-session" {
  interface SessionData {
    accessToken?: string;
    tokenType?: string;
    oauthState?: string;
    codeVerifier?: string;
  }
}

function getRedirectUri(req: Express.Request & { protocol: string; get: (h: string) => string | undefined }) {
  const host = req.get("host");
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  return `${protocol}://${host}/api/auth/callback`;
}

function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString("base64url")
    .slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64url");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET is not set — using a random value. Sessions will not persist across restarts.");
  }

  const isProduction = process.env.NODE_ENV === "production";

  app.set("trust proxy", 1);

  registerApiRoutes(app);

  const SessionStore = MemoryStore(session);

  app.use(
    session({
      secret: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({ checkPeriod: 86400000 }),
      cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.get("/api/auth/login", (req, res) => {
    if (!INSTAWORK_CLIENT_ID) {
      return res.status(500).send("INSTAWORK_CLIENT_ID is not configured");
    }

    const state = randomBytes(16).toString("hex");
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    const redirectUri = getRedirectUri(req as any);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: INSTAWORK_CLIENT_ID,
      redirect_uri: redirectUri,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    const authorizeUrl = `${INSTAWORK_BASE_URL}/oauth2/authorize/?${params.toString()}`;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Failed to save session");
      }
      res.redirect(authorizeUrl);
    });
  });

  app.get("/api/auth/callback", async (req, res) => {
    const { code, state } = req.query;

    if (!code || typeof code !== "string") {
      return res.redirect("/?error=no_code");
    }

    if (!state || state !== req.session.oauthState) {
      console.error("State mismatch:", { received: state, expected: req.session.oauthState });
      return res.redirect("/?error=invalid_state");
    }

    const codeVerifier = req.session.codeVerifier;
    if (!codeVerifier) {
      console.error("Missing code_verifier in session");
      return res.redirect("/?error=missing_verifier");
    }

    delete req.session.oauthState;
    delete req.session.codeVerifier;

    const redirectUri = getRedirectUri(req as any);

    try {
      const tokenResponse = await fetch(`${INSTAWORK_BASE_URL}/oauth2/token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: INSTAWORK_CLIENT_ID,
          client_secret: INSTAWORK_CLIENT_SECRET,
          redirect_uri: redirectUri,
          code: code,
          code_verifier: codeVerifier,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", tokenResponse.status, errorText);
        return res.redirect("/?error=token_exchange_failed");
      }

      const tokenData = await tokenResponse.json();
      req.session.accessToken = tokenData.access_token;
      req.session.tokenType = tokenData.token_type || "Bearer";

      req.session.save((err) => {
        if (err) {
          console.error("Session save error after token:", err);
          return res.redirect("/?error=session_error");
        }
        res.redirect("/?auth=success");
      });
    } catch (error) {
      console.error("Token exchange error:", error);
      res.redirect("/?error=token_exchange_error");
    }
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({
      authenticated: !!req.session.accessToken,
    });
  });

  app.get("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/users/me", async (req, res) => {
    if (!req.session.accessToken) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const response = await fetch(`${INSTAWORK_BASE_URL}/api/users/me/`, {
        headers: {
          Authorization: `${req.session.tokenType || "Bearer"} ${req.session.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Instawork API error:", response.status, errorText);
        return res.status(response.status).json({ error: "Failed to fetch user data", details: errorText });
      }

      const userData = await response.json();
      res.json(userData);
    } catch (error) {
      console.error("Instawork API request error:", error);
      res.status(500).json({ error: "Failed to connect to Instawork API" });
    }
  });

  /** Fetch the logged-in Instawork user via the session's access token. */
  async function fetchInstaworkUser(req: { session: session.Session & Partial<session.SessionData> }) {
    const response = await fetch(`${INSTAWORK_BASE_URL}/api/users/me/`, {
      headers: {
        Authorization: `${req.session.tokenType || "Bearer"} ${req.session.accessToken}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Instawork API error:", response.status, errorText);
      return null;
    }
    return response.json();
  }

  // Current user from the OAuth session (worker identity for eligibility).
  app.get("/api/me", async (req, res) => {
    if (!req.session.accessToken) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const userData = await fetchInstaworkUser(req);
      const resolved = resolveInstaworkUser(userData);
      if (!resolved) {
        return res.status(502).json({ error: "Failed to fetch user data" });
      }
      res.json(resolved);
    } catch (error) {
      console.error("Instawork API request error:", error);
      res.status(500).json({ error: "Failed to connect to Instawork API" });
    }
  });

  // Auth-required eligibility: what the logged-in worker may still book at each
  // site. Never keyed by name/phone from the client.
  //
  // Mode only has a participant_booking row for workers who have booked before,
  // so an absent row is not an error — it means "never booked here". Those sites
  // report the full cap, unblocked, rather than being dropped from the list.
  app.get("/api/eligibility", async (req, res) => {
    if (!req.session.accessToken) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Each step reports a distinct `reason` so a failure in the field can be
    // told apart from the others without a stack trace reaching the client.
    let step: "worker" | "bookings" | "sites" = "worker";
    try {
      const userData = await fetchInstaworkUser(req);
      const resolved = resolveInstaworkUser(userData);
      if (!resolved) {
        return res
          .status(502)
          .json({ error: "Could not resolve your worker account", reason: "worker_unresolved" });
      }
      const { workerId } = resolved;
      step = "bookings";
      const bookings = await prisma.participantBooking.findMany({ where: { workerId } });
      step = "sites";
      const rows = await getServableRows();
      const bookingByBusiness = new Map(bookings.map((b) => [b.businessId, b]));

      // Every site currently offering sessions, first row per business wins.
      const openSites = new Map<number, string>();
      for (const row of rows) {
        if (row.businessId == null || openSites.has(row.businessId)) continue;
        const city = sanitizeLabel(row.city);
        const stateCode = sanitizeLabel(row.stateCode);
        const neighborhood = sanitizeLabel(row.siteLabel);
        const cityLabel = city && stateCode ? `${city}, ${stateCode}` : city;
        openSites.set(
          row.businessId,
          [neighborhood, cityLabel].filter(Boolean).join(", ") || "Session site",
        );
      }

      type Booking = (typeof bookings)[number];
      const toSite = (businessId: number, fallbackLabel: string, b: Booking | undefined) => {
        const cap = b?.cap ?? getLifetimeCap(businessId);
        return {
          businessId,
          siteLabel: (b && sanitizeLabel(b.siteLabel)) || fallbackLabel,
          cap,
          remaining: b?.isBlocked ? 0 : Math.max(0, b?.remaining ?? cap),
          completedCount: b?.completedCount ?? 0,
          bookedCount: b?.bookedCount ?? 0,
          isBlocked: b?.isBlocked ?? false,
        };
      };

      const sites = [
        ...Array.from(openSites, ([businessId, label]) =>
          toSite(businessId, label, bookingByBusiness.get(businessId)),
        ),
        // Sites they have history at but which have no open sessions today —
        // still worth showing, especially when blocked.
        ...bookings
          .filter((b) => !openSites.has(b.businessId))
          .map((b) => toSite(b.businessId, "Session site", b)),
      ].sort((a, b) => a.siteLabel.localeCompare(b.siteLabel));

      res.json({ workerId, sites });
    } catch (error) {
      // `step` names which dependency broke: reading participant_booking, or
      // reading shift_group. Both are Postgres reads, so a missing table or an
      // unset DATABASE_URL lands here rather than surfacing as an empty list.
      console.error(`eligibility lookup failed at step "${step}":`, error);
      res.status(500).json({
        error: "We couldn't check right now — please try again",
        reason: step === "bookings" ? "bookings_unavailable" : "sites_unavailable",
      });
    }
  });

  return httpServer;
}
