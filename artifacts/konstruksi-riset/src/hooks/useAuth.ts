import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuthState {
  checked: boolean;       // initial status check done
  authEnabled: boolean;   // PLATFORM_PASSWORD is set on the server
  authenticated: boolean; // current session is valid
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    checked: false,
    authEnabled: false,
    authenticated: false,
  });

  // Check session status on mount
  useEffect(() => {
    fetch(`${API}/api/auth/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { authEnabled: boolean; authenticated: boolean }) => {
        setState({ checked: true, authEnabled: data.authEnabled, authenticated: data.authenticated });
      })
      .catch(() => {
        // Network error or endpoint unavailable.
        // Default to open (no password) so an unrelated server blip doesn't
        // lock everyone out of a deploy that never configured PLATFORM_PASSWORD.
        // If auth IS enabled but the request fails, the next page load will retry.
        setState({ checked: true, authEnabled: false, authenticated: false });
      });
  }, []);

  const login = useCallback(async (password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setState((s) => ({ ...s, authenticated: true }));
        return { ok: true };
      }
      const body = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, error: body.error ?? "Login gagal" };
    } catch {
      return { ok: false, error: "Tidak dapat terhubung ke server" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    // Full page reload so every useAuth instance re-checks the session
    // and the login gate appears cleanly without stale in-memory state.
    window.location.href = import.meta.env.BASE_URL || "/";
  }, []);

  return { ...state, login, logout };
}
