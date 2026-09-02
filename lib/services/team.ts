import { apiEnvelope } from "@/lib/apiClient";

/** Matches Mboka `MembershipRole`. */
export type MembershipRole =
  | "admin"
  | "developer"
  | "finance"
  | "operator"
  | "viewer";

export type TeamMember = {
  user_id: number;
  email: string;
  role: MembershipRole;
  status: string;
  invited_by_user_id: number | null;
  created_at: string | null;
};

export type TeamInvite = {
  id: number;
  email: string;
  role: MembershipRole;
  status: string;
  invited_by_user_id: number | null;
  expires_at: string;
  created_at: string | null;
};

export type TeamList = {
  members: TeamMember[];
  invites: TeamInvite[];
};

export type InviteCreated = TeamInvite & {
  invite_token: string;
};

export type InviteMemberIn = {
  email: string;
  role: MembershipRole;
  /** Frontend deep-link base; backend appends `?token=` / `&token=`. */
  accept_url?: string;
};

export type AcceptInviteOut = {
  business_id: number;
  user_id: number;
  role: MembershipRole;
};

export const MEMBERSHIP_ROLES: ReadonlyArray<{
  key: MembershipRole;
  label: string;
  desc: string;
}> = [
  { key: "admin", label: "Admin", desc: "Full access, including team and API keys" },
  { key: "developer", label: "Developer", desc: "Manage API keys and integrations" },
  { key: "finance", label: "Finance", desc: "Move money, view balances and reports" },
  { key: "operator", label: "Operator", desc: "Create payouts; no team or key access" },
  { key: "viewer", label: "Viewer", desc: "Read-only access to balances and activity" },
];

export function canManageTeam(role: string | null | undefined): boolean {
  return (role ?? "").toLowerCase() === "admin";
}

export function roleLabel(role: string | null | undefined): string {
  const key = (role ?? "").toLowerCase();
  return MEMBERSHIP_ROLES.find((r) => r.key === key)?.label ?? role ?? "Member";
}

/** Display label when the API only returns email. */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() || email;
  return local
    .replace(/[._+-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function initialsFromEmail(email: string): string {
  const name = displayNameFromEmail(email);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function defaultTeamAcceptUrl(origin?: string): string {
  const base =
    (origin && origin.trim()) ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/team/accept`;
}

export const teamApi = {
  list: (businessId: number) =>
    apiEnvelope<TeamList>("GET", `/businesses/${businessId}/members`),

  invite: (businessId: number, body: InviteMemberIn) =>
    apiEnvelope<InviteCreated>("POST", `/businesses/${businessId}/members/invite`, body),

  updateRole: (businessId: number, userId: number, role: MembershipRole) =>
    apiEnvelope<TeamMember>("PATCH", `/businesses/${businessId}/members/${userId}`, {
      role,
    }),

  remove: (businessId: number, userId: number) =>
    apiEnvelope<null>("DELETE", `/businesses/${businessId}/members/${userId}`),

  revokeInvite: (businessId: number, inviteId: number) =>
    apiEnvelope<null>("DELETE", `/businesses/${businessId}/invites/${inviteId}`),

  acceptInvite: (token: string) =>
    apiEnvelope<AcceptInviteOut>("POST", `/businesses/invites/accept`, { token }),
};
