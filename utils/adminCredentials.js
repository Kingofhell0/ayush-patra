// One shared rule for "is this a usable first-admin login?" (used by seed, reset and first-start setup).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXAMPLE_PASSWORD = /ChangeThisPassword|password123|12345678|^admin/i;

function credentialsProblem(email, password) {
  if (!email || !EMAIL_RE.test(email) || email.length > 254) return "ADMIN_EMAIL is missing or not a valid email address.";
  if (/@example\.(com|org|net)$/i.test(email)) return "ADMIN_EMAIL is still the example value. Use your own email.";
  if (!password || password.length < 10) return "ADMIN_PASSWORD must be at least 10 characters.";
  if (EXAMPLE_PASSWORD.test(password)) return "ADMIN_PASSWORD is the example value or too guessable. Choose a strong, unique password.";
  return null;
}

module.exports = { credentialsProblem };
