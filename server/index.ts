import express from "express";
import path from "path";

const app = express();
const root = process.cwd();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const pages: Record<string, string> = {
  "/": "index.html",
  "/sessions": "sessions.html",
  "/session": "session.html",
  "/login": "login.html",
  "/signup": "signup.html",
};

for (const [route, file] of Object.entries(pages)) {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(root, file));
  });
}

for (const asset of [
  "styles.css",
  "app.js",
  "index.html",
  "sessions.html",
  "session.html",
  "login.html",
  "signup.html",
]) {
  app.get(`/${asset}`, (_req, res) => {
    res.sendFile(path.join(root, asset));
  });
}

const port = parseInt(process.env.PORT || "5000", 10);
app.listen(port, "0.0.0.0", () => {
  console.log(`[express] serving on port ${port}`);
});
