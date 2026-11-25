/**
 * Invoice customers for the create-invoice picker (BFF-only).
 *
 * Backends (first match):
 * 1. Vercel KV REST (`KV_REST_API_URL` + `KV_REST_API_TOKEN`)
 * 2. Local JSON at `.data/invoice-customers.json` (dev)
 * 3. In-memory fallback (serverless read-only FS — avoids 500 on POST)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { InvoiceCustomer, InvoiceCustomerCreate } from "@/lib/services/invoiceCustomers";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "invoice-customers.json");

type StoreShape = { byBusinessId: Record<string, InvoiceCustomer[]> };

let memory: StoreShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

function emptyStore(): StoreShape {
  return { byBusinessId: {} };
}

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim());
}

function businessKey(businessId: number): string {
  return String(businessId);
}

async function kvGet(businessId: number): Promise<InvoiceCustomer[]> {
  const base = process.env.KV_REST_API_URL!.replace(/\/$/, "");
  const key = `invoice-customers:biz:${businessId}`;
  const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { result?: string | null };
  if (!json.result) return [];
  try {
    const parsed = JSON.parse(json.result) as InvoiceCustomer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function kvSet(businessId: number, items: InvoiceCustomer[]): Promise<void> {
  const base = process.env.KV_REST_API_URL!.replace(/\/$/, "");
  const key = `invoice-customers:biz:${businessId}`;
  const res = await fetch(`${base}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    throw new Error(`KV set failed (${res.status})`);
  }
}

async function ensureLoaded(): Promise<StoreShape> {
  if (memory) return memory;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    memory = JSON.parse(raw) as StoreShape;
    if (!memory?.byBusinessId) memory = emptyStore();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn("[invoiceCustomersStore] read failed, starting empty:", err);
    }
    memory = emptyStore();
  }
  return memory;
}

async function persistFile(store: StoreShape): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
  });
  await writeChain;
}

async function persist(store: StoreShape): Promise<void> {
  memory = store;
  try {
    await persistFile(store);
  } catch (err) {
    console.warn("[invoiceCustomersStore] file persist failed (memory only):", err);
  }
}

export async function listInvoiceCustomers(businessId: number): Promise<InvoiceCustomer[]> {
  if (kvConfigured()) {
    return kvGet(businessId);
  }
  const store = await ensureLoaded();
  return store.byBusinessId[businessKey(businessId)] ?? [];
}

export async function createInvoiceCustomer(
  businessId: number,
  input: InvoiceCustomerCreate,
): Promise<InvoiceCustomer> {
  const now = new Date().toISOString();
  const row: InvoiceCustomer = {
    id: randomUUID(),
    businessId,
    name: input.name,
    email: input.email,
    country: input.country ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (kvConfigured()) {
    const list = await kvGet(businessId);
    const next = [row, ...list];
    await kvSet(businessId, next);
    return row;
  }

  const store = await ensureLoaded();
  const key = businessKey(businessId);
  const list = store.byBusinessId[key] ?? [];
  store.byBusinessId[key] = [row, ...list];
  await persist(store);
  return row;
}

export async function deleteInvoiceCustomer(businessId: number, id: string): Promise<boolean> {
  if (kvConfigured()) {
    const list = await kvGet(businessId);
    const next = list.filter((c) => c.id !== id);
    if (next.length === list.length) return false;
    await kvSet(businessId, next);
    return true;
  }

  const store = await ensureLoaded();
  const key = businessKey(businessId);
  const list = store.byBusinessId[key] ?? [];
  const next = list.filter((c) => c.id !== id);
  if (next.length === list.length) return false;
  store.byBusinessId[key] = next;
  await persist(store);
  return true;
}
