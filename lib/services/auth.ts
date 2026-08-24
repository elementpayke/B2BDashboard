import { authEnvelope } from "@/lib/apiClient";

export type LoginResult = {
  token_type: string;
  kyb_status: string | null;
  role: string | null;
  user_id: number;
  business_id: number | null;
  wallet_address: string | null;
  /** Present once Mboka enriches login; optional for older responses. */
  business_name?: string | null;
};

export type AuthMeUser = {
  id: number;
  email: string;
  email_verified: boolean;
  kyc_verified: boolean;
};

export type AuthMeBusiness = {
  id: number;
  name: string;
  legal_name: string | null;
  country: string;
  status: string;
  kyb_verified: boolean;
  registration_number: string | null;
};

export type KybSummary = {
  profile: Record<string, unknown> | null;
};

export type AuthMe = {
  user: AuthMeUser;
  business: AuthMeBusiness | null;
  role: string | null;
  kyb_summary: KybSummary | null;
};

/**
 * Build a partial `auth-me` cache entry from the login response so the
 * dashboard shell (role, KYB chip, business id) can paint before `/me`
 * returns. Full `/me` still replaces this once it settles.
 */
export function authMePlaceholderFromLogin(
  login: LoginResult,
  email: string,
): AuthMe {
  const businessName =
    (login.business_name && login.business_name.trim()) || "Your business";
  return {
    user: {
      id: login.user_id,
      email: email.trim(),
      email_verified: true,
      kyc_verified: false,
    },
    business:
      typeof login.business_id === "number" && Number.isFinite(login.business_id)
        ? {
            id: login.business_id,
            name: businessName,
            legal_name: null,
            country: "",
            status: "active",
            kyb_verified: login.kyb_status === "approved",
            registration_number: null,
          }
        : null,
    role: login.role,
    kyb_summary: login.kyb_status
      ? { profile: { kyb_status: login.kyb_status } }
      : null,
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    authEnvelope<LoginResult>("POST", "/api/auth/login", { email, password }),

  signup: (business_name: string, email: string, password: string, country?: string) =>
    authEnvelope<{ business_id: number; owner_user_id: number; verification_required: boolean }>(
      "POST",
      "/api/auth/signup",
      { business_name, email, password, country },
    ),

  me: () => authEnvelope<AuthMe>("GET", "/api/auth/me"),

  logout: () => authEnvelope<null>("POST", "/api/auth/logout"),

  verifyEmail: (email: string, verification_code: string) =>
    authEnvelope<{ ok: boolean }>("POST", "/api/auth/verify-email", { email, verification_code }),

  resendVerification: (email: string) =>
    authEnvelope<{ ok: boolean }>("POST", "/api/auth/resend-verification", { email }),

  forgotPassword: (email: string) =>
    authEnvelope<{ ok: boolean }>("POST", "/api/auth/forgot-password", { email }),

  resetPassword: (email: string, token: string, new_password: string) =>
    authEnvelope<{ ok: boolean }>("POST", "/api/auth/reset-password", { email, token, new_password }),
};
