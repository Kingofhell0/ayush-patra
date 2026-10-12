require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const bootstrap = require("./utils/bootstrap");
const rateLimit = require("./middleware/rateLimit");
const { requirePageAuth } = require("./middleware/authMiddleware");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !process.env.MONGODB_URI) {
  console.error("Set MONGODB_URI and a JWT_SECRET of at least 32 characters in .env.");
  process.exit(1);
}

// The example text from .env.example is public: anyone could use it to forge admin sessions.
if (/replace_with|replace_this|change_?me|change_this|your_secret|example|placeholder|^(.)\1+$/i.test(process.env.JWT_SECRET)) {
  console.error("JWT_SECRET is still an example/placeholder value. Generate a real one: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
  process.exit(1);
}

const app = express();

app.disable("x-powered-by");
// Behind Render/Heroku/nginx the real visitor IP comes from the proxy; without this
// every visitor looks like one IP and the login rate limit would block everybody.
if (process.env.NODE_ENV === "production" || process.env.RENDER || process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Basic security headers
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  });
  if (process.env.NODE_ENV === "production") {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Same-origin guard for browser state changes. Requests without Origin (for
// server-to-server maintenance tools) remain supported; cookie-authenticated
// browser requests carrying a foreign Origin are rejected.
app.use((req, res, next) => {
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!mutating || !req.path.startsWith("/api/") || !req.get("origin")) return next();
  try {
    const origin = new URL(req.get("origin"));
    const host = req.get("host");
    if (origin.host.toLowerCase() !== String(host || "").toLowerCase() || origin.protocol !== (req.protocol + ":")) {
      return res.status(403).json({ message: "Cross-origin request blocked" });
    }
  } catch (_) {
    return res.status(403).json({ message: "Invalid request origin" });
  }
  next();
});

// Uptime / hosting health check (no database access, nothing sensitive).
app.get("/healthz", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

// Admin pages and APIs must never be cached, so the Back button can't
// show a dashboard after logout.
app.use(["/admin", "/dashboard", "/api/admin", "/api/auth", "/api/portfolio"], (req, res, next) => {
  res.set("Cache-Control", "no-store, max-age=0");
  next();
});

// Admin HTML must only be reachable through the guarded routes below,
// not as raw static files (/admin/dashboard.html).
app.use((req, res, next) => {
  if (req.path.startsWith("/admin/")) return res.redirect("/admin");
  next();
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "login.html"));
});

app.use(express.static(path.join(__dirname, "public"), { redirect: false }));

app.use(
  "/api/auth/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.LOGIN_RATE_MAX) || 10, message: "Too many login attempts. Try again in 15 minutes." })
);

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/admin/account", require("./routes/accountRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/portfolio", require("./routes/publicRoutes"));

app.get("/dashboard", requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "dashboard.html"));
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await connectDB();
    try {
      await bootstrap();
    } catch (error) {
      console.error("First-start setup problem:", error.message); // the site can still start; fix the cause and restart
    }
    app.listen(PORT, () => {
      console.log(`Portfolio server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

start();
