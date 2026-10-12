const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

// A session is valid only if the token is genuine AND its version still matches
// the account. Changing the password / email or "sign out everywhere" bumps the
// version, which instantly invalidates every older (possibly stolen) session.
async function getAdminFromRequest(req) {
  const token = req.cookies.adminToken;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (!admin) return null;
    if ((admin.tokenVersion || 0) !== decoded.tv) return null;
    return admin;
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) return res.status(401).json({ message: "Authentication required" });

    req.adminDoc = admin;
    req.admin = { id: admin._id.toString(), email: admin.email, name: admin.name };
    return next();
  } catch (_) {
    return res.status(503).json({ message: "Authentication service temporarily unavailable" });
  }
}

// For HTML pages: redirect to the login page instead of returning JSON.
async function requirePageAuth(req, res, next) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) return res.redirect(303, "/admin");
    return next();
  } catch (_) {
    return res.redirect(303, "/admin");
  }
}

module.exports = requireAuth;
module.exports.requirePageAuth = requirePageAuth;
module.exports.getAdminFromRequest = getAdminFromRequest;
