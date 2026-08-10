# Saved recipients (beneficiaries)

Dashboard-owned address book for the Send money **"select from saved details"** flow.
There is **no Mboka beneficiaries API** today — these routes live on the Next.js
BFF and persist per authenticated business until a real upstream store exists.

## Auth

| Requirement | Detail |
|---|---|
| Session | Same `mboka_at` / `mboka_rt` httpOnly cookies as the rest of the dashboard |
| Scope | Recipients are keyed by `business.id` from `GET /api/auth/me` |
| Unauthenticated | `401` envelope `{ status: "error", message, data: null }` |
| No business on session | `403` — user must be a business member |

Tokens never reach the browser. Route handlers resolve the business via a
cookie-authenticated call to Mboka `GET /api/auth/me` (refresh-on-401 once,
same idea as `lib/server/mbokaProxy.ts`).

## Types

```ts
type RailType = "bank" | "mobile" | "crypto";

type SavedRecipient = {
  id: string;                 // opaque UUID
  businessId: number;
  label: string;              // display name / nickname (from recipient name)
  accountNumber: string;      // bank account, MoMo phone, or crypto address
  railType: RailType;
  countryCode?: string | null; // ISO corridor, e.g. "KE"
  currency?: string | null;    // corridor fiat / asset, e.g. "KES" | "USDC"
  provider?: string | null;    // momo/bank provider id or label
  network?: string | null;     // crypto only: "Base" | "Polygon" | …
  createdAt: string;           // ISO-8601
  updatedAt: string;
};

type SavedRecipientCreate = {
  label: string;
  accountNumber: string;
  railType: RailType;
  countryCode?: string | null;
  currency?: string | null;
  provider?: string | null;
  network?: string | null;
};

type SavedRecipientList = {
  items: SavedRecipient[];
  total: number;
};
```

All responses use the shared dashboard envelope:

```json
{ "status": "success" | "error", "message": string, "data": T | null }
```

## Endpoints

| Method | Path | Body | Success `data` |
|---|---|---|---|
| `GET` | `/api/saved-recipients` | — | `SavedRecipientList` (newest first) |
| `POST` | `/api/saved-recipients` | `SavedRecipientCreate` | `SavedRecipient` (`201`) |
| `DELETE` | `/api/saved-recipients/{id}` | — | `null` |

### Validation (create)

- `label` — non-empty, ≤ 120 chars after trim (**alias:** `name`)
- `accountNumber` — non-empty, ≤ 256 chars after trim (**alias:** `account`)
- `railType` — one of `bank` \| `mobile` \| `crypto` (**alias:** `rail`)
- Extra UI-only fields such as `countryName` are ignored
- `network` — required when `railType === "crypto"` (sent for crypto sends); otherwise optional / may be `null`
- Optional fields trimmed; empty string → `null`
- Max **100** recipients per business (soft limit; `400` when exceeded)

### Delete

- `404` if `id` is unknown **or** belongs to another business (no cross-tenant leak)

## Client

**Shared types + helpers** — `lib/services/savedRecipients.ts` (schemas,
`toSendFormFields`, summary formatting).

**Browser client (session cookies)** — `lib/clients/savedRecipientsApi.ts`:
calls same-origin `/api/saved-recipients` (not `/api/mboka/...`). Falls back
to `localStorage` only on transport failure (offline); auth and API errors
are rethrown.

```ts
import {
  listSavedRecipients,
  createSavedRecipient,
  formatSavedRecipientSubtitle,
} from "@/lib/clients/savedRecipientsApi";
import { toSendFormFields } from "@/lib/services/savedRecipients";

const rows = await listSavedRecipients();
const saved = await createSavedRecipient({
  name: recipientName,
  account: phoneOrAccountOrAddress,
  rail: "mobile", // or bank | crypto
  countryCode: "KE",
  currency: "KES",
  provider: selectedProviderName,
  network: undefined, // required for crypto (e.g. "Base")
});

// Prefill Send form after user picks a row
const fields = toSendFormFields(saved);
```

## Persistence

`lib/server/savedRecipientsStore.ts` writes `.data/saved-recipients.json`
(gitignored) for local durability. Process memory is hydrated from that file.

> **TODO:** replace with Postgres or Vercel KV keyed by `business_id` before
> multi-instance / serverless production use. Ephemeral filesystems will drop
> data on redeploy.

## Not in this scaffold

- Mboka proxy endpoints (none documented)
- Update/PATCH of an existing recipient
- Sharing recipients across team members beyond the business scope
