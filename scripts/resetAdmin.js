// Emergency recovery. Run on the server:   npm run reset-admin
// Sets the login email + password from .env (ADMIN_EMAIL / ADMIN_PASSWORD),
// turns two-factor OFF, clears any lockout and signs out every session.
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Admin = require("../models/Admin");
const { credentialsProblem } = require("../utils/adminCredentials");

async function reset() {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";

  const problem = credentialsProblem(email, password);
  if (problem) throw new Error(problem);

  // This is a single-admin site: always update THE admin, even if its email was changed in the dashboard.
  const admin = (await Admin.findOne()) || new Admin({ name: "Ayush" });

  admin.email = email;
  admin.password = await bcrypt.hash(password, 12);
  admin.tokenVersion = (admin.tokenVersion || 0) + 1;
  admin.failedAttempts = 0;
  admin.lockUntil = null;
  admin.totpEnabled = false;
  admin.totpSecret = "";
  admin.pendingTotpSecret = "";
  admin.lastTotpStep = 0;
  await admin.save();

  console.log(`Admin reset. Log in at /admin with ${email}. Two-factor is off; set it up again in Settings.`);
  console.log("Tip: now remove ADMIN_PASSWORD from .env.");
  await mongoose.connection.close();
}

reset().catch(async (error) => {
  console.error(error.message);
  await mongoose.connection.close();
  process.exit(1);
});
