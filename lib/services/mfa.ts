import { authEnvelope } from "@/lib/apiClient";
import type { LoginSuccess } from "@/lib/services/auth";

export type EnrollStartResult = {
  secret_base32: string;
  otpauth_uri: string;
};

/** `backup_codes` is always present. The setup-token (mandatory-setup) path
 * also completes the deferred login, so the remaining `LoginSuccess` fields
 * ride along too — absent for voluntary enrollment from settings. */
export type EnrollConfirmResult = { backup_codes: string[] } & Partial<LoginSuccess>;

/**
 * Client-side calls for the TOTP 2FA flows. Like `authApi`, these hit our
 * own dedicated `/api/auth/mfa/...` routes (not the generic `/api/mboka`
 * proxy) since they intercept/emit cookies rather than just passing an
 * existing session through.
 */
export const mfaApi = {
  enrollStart: () => authEnvelope<EnrollStartResult>("POST", "/api/auth/mfa/enroll/start"),

  enrollConfirm: (code: string) =>
    authEnvelope<EnrollConfirmResult>("POST", "/api/auth/mfa/enroll/confirm", { code }),

  /** `code` accepts either a TOTP code or a backup code. Returns the same
   * shape as a normal login success. */
  verify: (code: string) => authEnvelope<LoginSuccess>("POST", "/api/auth/mfa/verify", { code }),

  disable: (password: string, code: string) =>
    authEnvelope<null>("POST", "/api/auth/mfa/disable", { password, code }),

  reminderDismissed: () => authEnvelope<null>("POST", "/api/auth/mfa/reminder-dismissed"),
};
