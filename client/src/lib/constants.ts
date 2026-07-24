export const SIGNUP_FORM_URL = "https://app.instawork.com/worker?utm_source=instawork_research&utm_medium=web&utm_campaign=voice_sessions";

// ---------------------------------------------------------------------------
// Instawork auth URLs used by the "Book in the Instawork app" flow.
// INSTAWORK_LOGIN_URL is a PLACEHOLDER — replace with the real Instawork
// login page URL when available. INSTAWORK_SIGNUP_URL reuses the existing
// signup form URL already used elsewhere in the app.
// INSTAWORK_APP_DEEP_LINK_BASE is the base for shift deep links; each
// session's `bookUrl` (a universal link) is appended as `return_url`.
// ---------------------------------------------------------------------------
export const INSTAWORK_LOGIN_URL = "https://app.instawork.com/login"; // PLACEHOLDER — verify/replace
export const INSTAWORK_SIGNUP_URL = SIGNUP_FORM_URL;
export const INSTAWORK_APP_DEEP_LINK_BASE = "https://app.instawork.com"; // PLACEHOLDER — verify/replace
export const DEFAULT_SITE = { key: "philadelphia-pa", label: "Philadelphia, PA" };
export const EXCLUDED_STATES = ["Texas", "Washington", "Illinois"];
export const SESSION_CAP = 3;
