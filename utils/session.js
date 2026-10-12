const jwt = require("jsonwebtoken");

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production"
  // no maxAge => session cookie, dropped when the browser closes
});

function issueSession(res, admin) {
  const token = jwt.sign(
    { id: admin._id.toString(), tv: admin.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  res.cookie("adminToken", token, cookieOptions());
}

function clearSession(res) {
  res.clearCookie("adminToken", cookieOptions());
}

module.exports = { issueSession, clearSession };
