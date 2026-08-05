import { apiEnvelope } from "@/lib/apiClient";

export type ApiKeyEnvironment = "sandbox" | "live";

export type ApiKeyListItem = {
  id: number;
  name: string;
  key: string; // masked: key_prefix + "..."
  environment: ApiKeyEnvironment;
  revoked: boolean;
  created_at: string;
  last_used_at: string | null;
  business_id: number | null;
  user_id: number | null;
  created_by_user_id: number | null;
};

export type ApiKeyDetail = ApiKeyListItem & {
  scopes: string[] | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  send_sms_notifications: boolean;
  last_rotated_at: string | null;
  updated_at: string;
};

/** Only returned once, from create/rotate. Never persisted or re-fetched. */
export type ApiKeyWithFullKey = ApiKeyDetail;

export type ApiKeyCreateIn = {
  name: string;
  environment: ApiKeyEnvironment;
  scopes?: string[];
  webhook_url?: string;
  webhook_secret?: string;
  send_sms_notifications?: boolean;
};

export const apiKeysApi = {
  create: (body: ApiKeyCreateIn) => apiEnvelope<ApiKeyWithFullKey>("POST", "/api-keys/", body),

  list: (params?: { environment?: ApiKeyEnvironment; include_revoked?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.environment) qs.set("environment", params.environment);
    if (params?.include_revoked != null) qs.set("include_revoked", String(params.include_revoked));
    const query = qs.toString();
    return apiEnvelope<ApiKeyListItem[]>("GET", `/api-keys/${query ? `?${query}` : ""}`);
  },

  get: (id: number) => apiEnvelope<ApiKeyDetail>("GET", `/api-keys/${id}`),

  update: (
    id: number,
    body: Partial<{
      name: string;
      scopes: string[];
      webhook_url: string;
      webhook_secret: string;
      send_sms_notifications: boolean;
    }>,
  ) => apiEnvelope<ApiKeyDetail>("PATCH", `/api-keys/${id}`, body),

  revoke: (id: number) => apiEnvelope<ApiKeyDetail>("POST", `/api-keys/${id}/revoke`),

  remove: (id: number) => apiEnvelope<null>("DELETE", `/api-keys/${id}`),

  rotate: (id: number) => apiEnvelope<ApiKeyWithFullKey>("POST", `/api-keys/${id}/rotate`),
};
