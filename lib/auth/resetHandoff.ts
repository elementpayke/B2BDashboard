/**
 * Password-reset handoff without putting email/code in durable query strings.
 * sessionStorage is tab-scoped and is cleared after a successful reset.
 */

const EMAIL_KEY = "ep_reset_email";
const CODE_KEY = "ep_reset_code";

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function stashResetEmail(email: string): void {
  const store = storage();
  if (!store) return;
  const trimmed = email.trim();
  if (trimmed) store.setItem(EMAIL_KEY, trimmed);
}

export function readResetHandoff(): { email: string; code: string } {
  const store = storage();
  if (!store) return { email: "", code: "" };
  return {
    email: store.getItem(EMAIL_KEY) || "",
    code: store.getItem(CODE_KEY) || "",
  };
}

export function clearResetHandoff(): void {
  const store = storage();
  if (!store) return;
  store.removeItem(EMAIL_KEY);
  store.removeItem(CODE_KEY);
}

/**
 * Consume legacy ?email=&code= deep links (Mboka email currently builds them),
 * stash into sessionStorage, and signal the caller to strip the query.
 */
export function takeQueryResetParams(
  searchParams: { get: (key: string) => string | null },
): { email: string; code: string; stripped: boolean } {
  const store = storage();
  if (!store) {
    return { email: "", code: "", stripped: false };
  }

  const email = (searchParams.get("email") || "").trim();
  const code = (searchParams.get("code") || "").trim();
  let stripped = false;

  if (email) {
    store.setItem(EMAIL_KEY, email);
    stripped = true;
  }
  if (code) {
    store.setItem(CODE_KEY, code);
    stripped = true;
  }

  return { email, code, stripped };
}
