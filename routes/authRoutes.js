const express = require("express");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const { getAdminFromRequest } = require("../middleware/authMiddleware");
const { issueSession, clearSession } = require("../utils/session");
const { verifyToken } = require("../utils/totp");

const router = express.Router();

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

// Compared against when the email doesn't exist, so response time
// doesn't reveal whether an email is registered.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

async function registerFailure(admin) {
  admin.failedAttempts = (admin.failedAttempts || 0) + 1;
  if (admin.failedAttempts >= MAX_FAILS) {
    admin.lockUntil = new Date(Date.now() + LOCK_MS);
    admin.failedAttempts = 0;
  }
  await admin.save();
}

router.post("/login", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.toLowerCase().trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const code = req.body.code;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email });

    if (admin && admin.lockUntil && admin.lockUntil.getTime() > Date.now()) {
      return res.status(429).json({ message: "Too many failed attempts. Login is locked for a while — try again later." });
    }

    const passwordOk = await bcrypt.compare(password, admin ? admin.password : DUMMY_HASH);

    if (!admin || !passwordOk) {
      if (admin) await registerFailure(admin);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Second factor
    if (admin.totpEnabled) {
      if (!code) {
        return res.status(401).json({ needs2fa: true, message: "Enter the 6-digit code from your authenticator app" });
      }

      const step = verifyToken(admin.totpSecret, code);
      if (step === null || step <= (admin.lastTotpStep || 0)) {
        await registerFailure(admin);
        return res.status(401).json({ needs2fa: true, message: "Invalid or expired code" });
      }
      admin.lastTotpStep = step;
    }

    admin.failedAttempts = 0;
    admin.lockUntil = null;
    admin.prevLoginAt = admin.lastLoginAt;
    admin.prevLoginIp = admin.lastLoginIp;
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = req.ip || "";
    await admin.save();

    issueSession(res, admin);
    res.json({ message: "Login successful" });
  } catch {
    res.status(500).json({ message: "Login failed" });
  }
});

router.post("/logout", (req, res) => {
  clearSession(res);
  res.json({ message: "Logged out" });
});

router.get("/me", async (req, res) => {
  const admin = await getAdminFromRequest(req);
  if (!admin) return res.status(401).json({ message: "Not logged in" });
  res.json({ admin: { name: admin.name, email: admin.email } });
});

module.exports = router;
