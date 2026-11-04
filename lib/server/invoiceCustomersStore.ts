import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { InvoiceCustomer, InvoiceCustomerCreate } from "@/lib/services/invoiceCustomers";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "invoice-customers.json");

type StoreShape = { byBusinessId: Record<string, InvoiceCustomer[]> };

let memory: StoreShape | null = null;

function emptyStore(): StoreShape {
  return { byBusinessId: {} };
}

async function loadStore(): Promise<StoreShape> {
  if (memory) return memory;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    memory = JSON.parse(raw) as StoreShape;
    return memory;
  } catch {
    memory = emptyStore();
    return memory;
  }
}

async function persist(store: StoreShape): Promise<void> {
  memory = store;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function listInvoiceCustomers(businessId: number): Promise<InvoiceCustomer[]> {
  const store = await loadStore();
  return store.byBusinessId[String(businessId)] ?? [];
}

export async function createInvoiceCustomer(
  businessId: number,
  input: InvoiceCustomerCreate,
): Promise<InvoiceCustomer> {
  const store = await loadStore();
  const key = String(businessId);
  const list = store.byBusinessId[key] ?? [];
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
  store.byBusinessId[key] = [row, ...list];
  await persist(store);
  return row;
}

export async function deleteInvoiceCustomer(
  businessId: number,
  id: string,
): Promise<boolean> {
  const store = await loadStore();
  const key = String(businessId);
  const list = store.byBusinessId[key] ?? [];
  const next = list.filter((c) => c.id !== id);
  if (next.length === list.length) return false;
  store.byBusinessId[key] = next;
  await persist(store);
  return true;
}
