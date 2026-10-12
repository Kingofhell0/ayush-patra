// Authenticator-app codes (RFC 6238 TOTP), no extra packages needed.
const crypto = require("crypto");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  }
  return out;
}

function base32Decode(text) {
  let bits = "";
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error("Invalid base32");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

// Returns the matching 30-second step number, or null. Accepts +/- 1 step for clock drift.
function verifyToken(secret, token, now = Date.now()) {
  const clean = String(token || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean) || !secret) return null;

  const step = Math.floor(now / 30000);
  let matched = null;
  for (let i = -1; i <= 1; i++) {
    const expected = Buffer.from(hotp(secret, step + i));
    if (crypto.timingSafeEqual(expected, Buffer.from(clean))) matched = step + i;
  }
  return matched;
}

function otpauthUrl(secret, account, issuer = "Portfolio Admin") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

module.exports = { generateSecret, verifyToken, otpauthUrl, hotp };
