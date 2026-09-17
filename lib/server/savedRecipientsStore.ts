/**
 * Server-only persistence for saved recipients.
 *
 * Backends (first match):
 * 1. Vercel KV REST (`KV_REST_API_URL` + `KV_REST_API_TOKEN`) — multi-instance
 * 2. Local JSON file at `.data/saved-recipients.json` (dev)
 *
 * Sensitive `accountNumber` is encrypted at rest (AES-256-GCM) when
 * `SAVED_RECIPIENTS_ENCRYPTION_KEY` is set (or derived from
 * `NEXTAUTH_SECRET` / `SESSION_SECRET` as a last resort).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import {
  SAVED_RECIPIENT_LIMITS,
  type SavedRecipient,
  type SavedRecipientCreate,
} from "@/lib/services/savedRecipients";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "saved-recipients.json");
const ENC_PREFIX = "enc:v1:";

type StoreShape = {
  byBusinessId: Record<string, SavedRecipient[]>;
};

let memory: StoreShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

function emptyStore(): StoreShape {
  return { byBusinessId: {} };
}

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim());
}

function encryptionKey(): Buffer | null {
  const raw =
    process.env.SAVED_RECIPIENTS_ENCRYPTION_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "";
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

function encryptAccountNumber(plain: string): string {
  const key = encryptionKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptAccountNumber(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const key = encryptionKey();
  if (!key) return stored;
  const body = stored.slice(ENC_PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return stored;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return stored;
  }
}

function reveal(recipient: SavedRecipient): SavedRecipient {
  return {
    ...recipient,
    accountNumber: decryptAccountNumber(recipient.accountNumber),
  };
}

function seal(recipient: SavedRecipient): SavedRecipient {
  return {
    ...recipient,
    accountNumber: encryptAccountNumber(recipient.accountNumber),
  };
}

async function kvGet(businessId: number): Promise<SavedRecipient[]> {
  const base = process.env.KV_REST_API_URL!.replace(/\/$/, "");
  const key = `saved-recipients:biz:${businessId}`;
  const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { result?: string | null };
  if (!json.result) return [];
  try {
    const parsed = JSON.parse(json.result) as SavedRecipient[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function kvSet(businessId: number, items: SavedRecipient[]): Promise<void> {
  const base = process.env.KV_REST_API_URL!.replace(/\/$/, "");
  const key = `saved-recipients:biz:${businessId}`;
  await fetch(`${base}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(items),
  });
}

async function ensureLoaded(): Promise<StoreShape> {
  if (memory) return memory;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed || typeof parsed !== "object" || !parsed.byBusinessId) {
      memory = emptyStore();
    } else {
      memory = { byBusinessId: parsed.byBusinessId ?? {} };
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn("[savedRecipientsStore] failed to read store, starting empty:", err);
    }
    memory = emptyStore();
  }
  return memory;
}

async function persist(store: StoreShape): Promise<void> {
  writeChain = writeChain.then(
    async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${DATA_FILE}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
      await fs.rename(tmp, DATA_FILE);
    },
    () => undefined,
  );
  await writeChain;
}

function businessKey(businessId: number): string {
  return String(businessId);
}

export async function listSavedRecipients(
  businessId: number,
): Promise<SavedRecipient[]> {
  if (kvConfigured()) {
    const items = await kvGet(businessId);
    return items.map(reveal).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  const store = await ensureLoaded();
  const items = store.byBusinessId[businessKey(businessId)] ?? [];
  return items.map(reveal).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createSavedRecipient(
  businessId: number,
  input: SavedRecipientCreate,
): Promise<{ ok: true; recipient: SavedRecipient } | { ok: false; status: 400; message: string }> {
  const now = new Date().toISOString();
  const recipient: SavedRecipient = {
    id: randomUUID(),
    businessId,
    label: input.label,
    accountNumber: input.accountNumber,
    railType: input.railType,
    countryCode: input.countryCode ?? null,
    currency: input.currency ?? null,
    provider: input.provider ?? null,
    network: input.network ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const sealed = seal(recipient);

  if (kvConfigured()) {
    const existing = await kvGet(businessId);
    if (existing.length >= SAVED_RECIPIENT_LIMITS.maxPerBusiness) {
      return {
        ok: false,
        status: 400,
        message: `Limit of ${SAVED_RECIPIENT_LIMITS.maxPerBusiness} saved recipients reached`,
      };
    }
    await kvSet(businessId, [sealed, ...existing]);
    return { ok: true, recipient };
  }

  const store = await ensureLoaded();
  const key = businessKey(businessId);
  const existing = store.byBusinessId[key] ?? [];
  if (existing.length >= SAVED_RECIPIENT_LIMITS.maxPerBusiness) {
    return {
      ok: false,
      status: 400,
      message: `Limit of ${SAVED_RECIPIENT_LIMITS.maxPerBusiness} saved recipients reached`,
    };
  }
  store.byBusinessId[key] = [sealed, ...existing];
  try {
    await persist(store);
  } catch (err) {
    console.warn("[savedRecipientsStore] persist failed (in-memory only):", err);
  }
  return { ok: true, recipient };
}

export async function deleteSavedRecipient(
  businessId: number,
  id: string,
): Promise<boolean> {
  if (kvConfigured()) {
    const existing = await kvGet(businessId);
    const next = existing.filter((r) => r.id !== id);
    if (next.length === existing.length) return false;
    await kvSet(businessId, next);
    return true;
  }
  const store = await ensureLoaded();
  const key = businessKey(businessId);
  const existing = store.byBusinessId[key] ?? [];
  const next = existing.filter((r) => r.id !== id);
  if (next.length === existing.length) return false;
  store.byBusinessId[key] = next;
  try {
    await persist(store);
  } catch (err) {
    console.warn("[savedRecipientsStore] persist failed (in-memory only):", err);
  }
  return true;
}

/** Test helper — reset store without touching disk when path override unused. */
export async function __resetSavedRecipientsStoreForTests(): Promise<void> {
  memory = emptyStore();
  writeChain = Promise.resolve();
}
