require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Admin = require("../models/Admin");
const PortfolioData = require("../models/PortfolioData");
const { credentialsProblem } = require("../utils/adminCredentials");

async function seed() {
  await connectDB();

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  const problem = credentialsProblem((email || "").toLowerCase().trim(), password || "");
  if (problem) throw new Error(problem);

  // Only ever create the first admin. If one exists (its email may have been
  // changed in the dashboard), don't create a second account: use reset-admin.
  if (await Admin.countDocuments()) {
    console.log("An admin already exists. To reset the login, run: npm run reset-admin");
  } else {
    await Admin.create({ email: email.toLowerCase(), password: await bcrypt.hash(password, 12), name: "Ayush" });
    console.log("Admin account created.");
  }

  await PortfolioData.findOneAndUpdate(
    { owner: "Ayush Bhajman Patra" },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Admin account and portfolio data are ready.");
  await mongoose.connection.close();
}

seed().catch(async (error) => {
  console.error(error.message);
  await mongoose.connection.close();
  process.exit(1);
});