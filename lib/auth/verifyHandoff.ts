/**
 * Email-verification handoff without putting email/code in durable query strings.
 * Mirrors reset-password sessionStorage pattern.
 */

const EMAIL_KEY = "ep_verify_email";
const CODE_KEY = "ep_verify_code";

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function stashVerifyEmail(email: string): void {
  const store = storage();
  if (!store) return;
  const trimmed = email.trim();
  if (trimmed) {
    store.setItem(EMAIL_KEY, trimmed);
    // New email-only handoffs must not keep a prior tab's code.
    store.removeItem(CODE_KEY);
  }
}

export function stashVerifyCode(code: string): void {
  const store = storage();
  if (!store) return;
  const trimmed = code.trim();
  if (trimmed) store.setItem(CODE_KEY, trimmed);
}

export function readVerifyHandoff(): { email: string; code: string } {
  const store = storage();
  if (!store) return { email: "", code: "" };
  return {
    email: store.getItem(EMAIL_KEY) || "",
    code: store.getItem(CODE_KEY) || "",
  };
}

export function clearVerifyHandoff(): void {
  const store = storage();
  if (!store) return;
  store.removeItem(EMAIL_KEY);
  store.removeItem(CODE_KEY);
}

function applyHandoffParams(
  email: string,
  code: string,
): { email: string; code: string; stripped: boolean } {
  const stripped = Boolean(email || code);
  const store = storage();

  if (!stripped) {
    if (!store) return { email: "", code: "", stripped: false };
    return {
      email: store.getItem(EMAIL_KEY) || "",
      code: store.getItem(CODE_KEY) || "",
      stripped: false,
    };
  }

  if (store) {
    if (email) {
      store.setItem(EMAIL_KEY, email);
      if (!code) store.removeItem(CODE_KEY);
    }
    if (code) store.setItem(CODE_KEY, code);
  }

  return {
    email: email || store?.getItem(EMAIL_KEY) || "",
    // Email-only deep links must not reuse a prior code from storage.
    code: code || (email ? "" : store?.getItem(CODE_KEY) || ""),
    stripped: true,
  };
}

/**
 * Consume legacy ?email=&code= deep links (Mboka / older clients),
 * stash into sessionStorage when available, and signal the caller to strip the query.
 * When storage is unavailable, still return the params with stripped:true so the
 * URL can be cleared while React state keeps the values.
 */
export function takeQueryVerifyParams(
  searchParams: { get: (key: string) => string | null },
): { email: string; code: string; stripped: boolean } {
  const email = (searchParams.get("email") || "").trim();
  const code = (searchParams.get("code") || "").trim();
  return applyHandoffParams(email, code);
}

/**
 * Consume #email=&code= handoffs (GET BFF redirect uses a fragment so the
 * credential never lands in query/referrer logs for /verify-email).
 */
export function takeHashVerifyParams(): {
  email: string;
  code: string;
  stripped: boolean;
} {
  if (typeof window === "undefined") {
    return { email: "", code: "", stripped: false };
  }
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) {
    return applyHandoffParams("", "");
  }
  const params = new URLSearchParams(raw);
  const result = applyHandoffParams(
    (params.get("email") || "").trim(),
    (params.get("code") || "").trim(),
  );
  if (result.stripped) {
    const path = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", path);
  }
  return result;
}
