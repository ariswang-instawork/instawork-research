import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { randomBytes } from "crypto";

const INSTAWORK_BASE_URL = process.env.INSTAWORK_BASE_URL || "http://localhost:8080";
const INSTAWORK_CLIENT_ID = process.env.INSTAWORK_CLIENT_ID!;
const INSTAWORK_CLIENT_SECRET = process.env.INSTAWORK_CLIENT_SECRET!;

declare module "express-session" {
  interface SessionData {
    accessToken?: string;
    tokenType?: string;
    oauthState?: string;
  }
}

function getRedirectUri(req: Express.Request & { protocol: string; get: (h: string) => string | undefined }) {
  const host = req.get("host");
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  return `${protocol}://${host}/api/auth/callback`;
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
    req.session.oauthState = state;

    const redirectUri = getRedirectUri(req as any);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: INSTAWORK_CLIENT_ID,
      redirect_uri: redirectUri,
      state: state,
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

    delete req.session.oauthState;

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

  return httpServer;
}
