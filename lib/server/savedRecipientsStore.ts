/**
 * Server-only persistence for saved recipients.
 *
 * Local/dev: JSON file at `.data/saved-recipients.json` (gitignored).
 * TODO: replace with Postgres or Vercel KV keyed by `business_id` before
 * multi-instance / serverless production — ephemeral disks drop this file
 * on redeploy.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  SAVED_RECIPIENT_LIMITS,
  type SavedRecipient,
  type SavedRecipientCreate,
} from "@/lib/services/savedRecipients";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "saved-recipients.json");

type StoreShape = {
  byBusinessId: Record<string, SavedRecipient[]>;
};

let memory: StoreShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

function emptyStore(): StoreShape {
  return { byBusinessId: {} };
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
      // Corrupt / unreadable file → start fresh rather than crashing routes.
      console.warn("[savedRecipientsStore] failed to read store, starting empty:", err);
    }
    memory = emptyStore();
  }
  return memory;
}

async function persist(store: StoreShape): Promise<void> {
  // Always continue the chain after reject so one failed write does not
  // poison every subsequent persist for the process lifetime.
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
  const store = await ensureLoaded();
  const items = store.byBusinessId[businessKey(businessId)] ?? [];
  // Newest first
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createSavedRecipient(
  businessId: number,
  input: SavedRecipientCreate,
): Promise<{ ok: true; recipient: SavedRecipient } | { ok: false; status: 400; message: string }> {
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

  store.byBusinessId[key] = [recipient, ...existing];
  try {
    await persist(store);
  } catch (err) {
    // File write may fail on read-only serverless FS — keep in-memory so the
    // current instance still works; surface the soft failure in logs.
    console.warn("[savedRecipientsStore] persist failed (in-memory only):", err);
  }
  return { ok: true, recipient };
}

export async function deleteSavedRecipient(
  businessId: number,
  id: string,
): Promise<boolean> {
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
