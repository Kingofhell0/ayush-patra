// First-start setup, so the site works on hosts that give no shell (e.g. Render free plan):
//  1. makes sure the portfolio data document exists (the public site needs it)
//  2. if there is NO admin yet and ADMIN_EMAIL / ADMIN_PASSWORD are set (and strong), creates the admin.
// It never touches an existing admin. After the first successful start, delete ADMIN_PASSWORD from the host settings.
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const PortfolioData = require("../models/PortfolioData");
const { credentialsProblem } = require("./adminCredentials");

async function bootstrap() {
  await PortfolioData.findOneAndUpdate(
    { owner: "Ayush Bhajman Patra" },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (await Admin.countDocuments()) return;

  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";
  const problem = credentialsProblem(email, password);

  if (problem) {
    console.warn(`No admin account exists yet, and none was created: ${problem}`);
    return;
  }

  await Admin.create({ email, password: await bcrypt.hash(password, 12), name: "Ayush" });
  console.log(`First admin account created for ${email}. Remove ADMIN_PASSWORD from your host's environment settings now.`);
}

module.exports = bootstrap;
