import { authEnvelope } from "@/lib/apiClient";

export type LoginResult = {
  token_type: string;
  kyb_status: string | null;
  role: string | null;
  user_id: number;
  business_id: number | null;
  wallet_address: string | null;
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
