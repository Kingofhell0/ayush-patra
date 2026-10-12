# Portfolio code and security audit

Audit date: 2026-10-10

## Fixes applied

- Fixed a front-end runtime exception: the public header's `logoMark` element had been removed from HTML while `anime.js` still wrote to it. That exception interrupted page rendering and broke the profile picker flow. The stale reference is removed.
- Added `public/img/logo.svg` and connected it to the browser tab favicon, public header, admin login page, and admin dashboard sidebar.
- Fixed a login/logout race: the login page now waits for stale-session cleanup before enabling submission, preventing a late logout response from clearing a newly issued login cookie.
- Validated saved profile modes before using them and made the profile picker available when no valid mode is stored.
- Made startup wait for MongoDB to connect before accepting requests; database startup errors now fail through the startup handler instead of leaving a half-started server.
- Hardened authentication middleware error handling and redirects.
- Added same-origin checks for state-changing `/api/*` browser requests when an `Origin` header is present.
- Added Content Security Policy and additional security response headers; HSTS is emitted in production.
- Enforced a 32-character minimum for `JWT_SECRET` and validated the initial admin email/password in the seed script.
- Improved small-screen admin layouts and public header/logo sizing.
- Updated setup/security documentation.

## Checks performed

- `node --check` passed for server, routes, middleware, models, scripts, utilities, and browser JavaScript.
- HTML checks found no duplicate IDs, missing local asset references, or unresolved literal `getElementById` references.
- CSS brace-balance checks passed for both stylesheets.
- Verified `hero.png` (900 × 1362 RGBA) and `poster.jpg` (720 × 969 RGB) are readable image files.
- Confirmed the archive contains no `.env` file; only `.env.example` is included.

## Remaining operational cautions

- A live `npm audit` advisory check could not reach `registry.npmjs.org` in this environment, so dependency advisories were not independently refreshed. Run `npm audit` from a network-connected environment before deployment.
- The login rate limiter is in-memory and is suitable only for a single server process; use a shared store if deploying multiple instances.
- TOTP secrets are stored in the database as application data. For higher-assurance production use, encrypt them at rest with a separately managed secret/key.
- These are static/code-level checks, not a live penetration test. Test authentication, database connectivity, and redirects with your actual `.env` and MongoDB before deployment.
