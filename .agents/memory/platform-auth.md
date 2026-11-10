---
name: Platform auth system
description: Cookie-based password gate for the web platform — how it works, key files, and operational notes.
---

# Platform Auth System

## Architecture
- `artifacts/api-server/src/lib/authSessions.ts` — in-memory `Set<string>` session store, `createSession`, `isValidSession`, `deleteSession`, `isAuthEnabled`
- `artifacts/api-server/src/routes/auth.ts` — POST `/auth/login`, POST `/auth/logout`, GET `/auth/status`
- `artifacts/api-server/src/app.ts` — `cookieParser()` middleware; auth middleware skips `/api/auth/*`, checks `platform_session` httpOnly cookie for all other `/api/*` routes
- `artifacts/konstruksi-riset/src/hooks/useAuth.ts` — fetches `/api/auth/status` on mount; exposes `login()`, `logout()`, `authenticated`, `authEnabled`, `checked`
- `artifacts/konstruksi-riset/src/pages/login.tsx` — login page with brand header, password field, eye toggle, error display
- `artifacts/konstruksi-riset/src/App.tsx` — `AuthGate` component wraps the router; shows spinner while `!checked`, shows `LoginPage` when `authEnabled && !authenticated`

## Enabling / disabling
- Set `PLATFORM_PASSWORD` secret → auth is ON (requires login)
- Remove `PLATFORM_PASSWORD` → auth is OFF (platform open, no login needed)
- **API server must be restarted** after secret is changed for the new value to take effect

## Sessions
- In-memory `Set<string>` — sessions are lost on API server restart
- Cookie `platform_session` is httpOnly, sameSite=lax, 7-day max-age
- `secure` flag only in production (NODE_ENV === "production")

**Why in-memory:** Acceptable for an internal tool; avoids needing a sessions DB table. If restart-persistence is needed, move to DB.

## Logout
- As of implementation, there is NO logout button in the UI
- Users can call `POST /api/auth/logout` directly, or wait for the 7-day cookie to expire
- Adding a logout button to the Shell sidebar footer is a natural follow-up
