const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, default: "Ayush" },

    // Bumped on every password/email change or "sign out everywhere".
    // Session tokens carry this number, so bumping it kills all older sessions at once.
    tokenVersion: { type: Number, default: 0 },

    // Brute-force protection
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    // Two-factor (authenticator app)
    totpEnabled: { type: Boolean, default: false },
    totpSecret: { type: String, default: "" },
    pendingTotpSecret: { type: String, default: "" },
    lastTotpStep: { type: Number, default: 0 }, // stops a code from being used twice

    // Shown in Settings so you can spot a login that wasn't you
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: "" },
    prevLoginAt: { type: Date, default: null },
    prevLoginIp: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
