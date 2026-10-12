const express = require("express");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const requireAuth = require("../middleware/authMiddleware");
const rateLimit = require("../middleware/rateLimit");
const { issueSession } = require("../utils/session");
const { generateSecret, verifyToken, otpauthUrl } = require("../utils/totp");

const router = express.Router();

router.use(requireAuth);
// Even with a hijacked session, guessing the current password here is capped.
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: "Too many attempts. Try again later." }));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;

const str = (value) => (typeof value === "string" ? value : "");

async function passwordMatches(admin, password) {
  return Boolean(password) && (await bcrypt.compare(password, admin.password));
}

// Bump the version (kills every other session) and keep THIS browser signed in.
async function rotateSessions(admin, res) {
  admin.tokenVersion = (admin.tokenVersion || 0) + 1;
  await admin.save();
  issueSession(res, admin);
}

router.get("/security", (req, res) => {
  const admin = req.adminDoc;
  res.json({
    email: admin.email,
    totpEnabled: admin.totpEnabled,
    previousLogin: admin.prevLoginAt ? { at: admin.prevLoginAt, ip: admin.prevLoginIp || "unknown" } : null
  });
});

router.post("/email", async (req, res) => {
  try {
    const admin = req.adminDoc;
    const newEmail = str(req.body.newEmail).toLowerCase().trim();

    if (!(await passwordMatches(admin, str(req.body.currentPassword)))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    if (!EMAIL_RE.test(newEmail) || newEmail.length > 254) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (newEmail === admin.email) {
      return res.status(400).json({ message: "That is already your login email" });
    }
    if (await Admin.findOne({ email: newEmail })) {
      return res.status(409).json({ message: "That email is already in use" });
    }

    admin.email = newEmail;
    await rotateSessions(admin, res);
    res.json({ message: "Login email changed. Other devices were signed out.", email: admin.email });
  } catch (error) {
    if (error && error.code === 11000) return res.status(409).json({ message: "That email is already in use" });
    res.status(500).json({ message: "Could not change email" });
  }
});

router.post("/password", async (req, res) => {
  try {
    const admin = req.adminDoc;
    const newPassword = str(req.body.newPassword);

    if (!(await passwordMatches(admin, str(req.body.currentPassword)))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    if (newPassword.length < MIN_PASSWORD) {
      return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD} characters` });
    }
    if (newPassword === str(req.body.currentPassword) || newPassword.toLowerCase() === admin.email) {
      return res.status(400).json({ message: "Choose a password that is different from your current one and your email" });
    }

    admin.password = await bcrypt.hash(newPassword, 12);
    await rotateSessions(admin, res);
    res.json({ message: "Password changed. Other devices were signed out." });
  } catch {
    res.status(500).json({ message: "Could not change password" });
  }
});

// "Sign out everywhere else" – the panic button.
router.post("/sessions/revoke", async (req, res) => {
  try {
    const admin = req.adminDoc;
    if (!(await passwordMatches(admin, str(req.body.currentPassword)))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    await rotateSessions(admin, res);
    res.json({ message: "All other sessions have been signed out" });
  } catch {
    res.status(500).json({ message: "Could not revoke sessions" });
  }
});

/* ---------- two-factor ---------- */

router.post("/2fa/setup", async (req, res) => {
  try {
    const admin = req.adminDoc;
    if (admin.totpEnabled) return res.status(400).json({ message: "Two-factor is already on" });
    if (!(await passwordMatches(admin, str(req.body.currentPassword)))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    admin.pendingTotpSecret = generateSecret();
    await admin.save();

    res.json({ secret: admin.pendingTotpSecret, otpauth: otpauthUrl(admin.pendingTotpSecret, admin.email) });
  } catch {
    res.status(500).json({ message: "Could not start setup" });
  }
});

router.post("/2fa/enable", async (req, res) => {
  try {
    const admin = req.adminDoc;
    if (!admin.pendingTotpSecret) return res.status(400).json({ message: "Start setup first" });

    const step = verifyToken(admin.pendingTotpSecret, req.body.code);
    if (step === null) return res.status(400).json({ message: "That code is not correct. Check your phone's clock and try again." });

    admin.totpSecret = admin.pendingTotpSecret;
    admin.pendingTotpSecret = "";
    admin.totpEnabled = true;
    admin.lastTotpStep = step;
    await rotateSessions(admin, res);

    res.json({ message: "Two-factor login is now ON" });
  } catch {
    res.status(500).json({ message: "Could not enable two-factor" });
  }
});

router.post("/2fa/disable", async (req, res) => {
  try {
    const admin = req.adminDoc;
    if (!admin.totpEnabled) return res.status(400).json({ message: "Two-factor is not on" });
    if (!(await passwordMatches(admin, str(req.body.currentPassword)))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const step = verifyToken(admin.totpSecret, req.body.code);
    if (step === null) return res.status(400).json({ message: "That code is not correct" });

    admin.totpEnabled = false;
    admin.totpSecret = "";
    admin.pendingTotpSecret = "";
    await rotateSessions(admin, res);

    res.json({ message: "Two-factor login is now OFF" });
  } catch {
    res.status(500).json({ message: "Could not disable two-factor" });
  }
});

module.exports = router;
