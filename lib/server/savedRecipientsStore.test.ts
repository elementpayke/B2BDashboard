import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  __resetSavedRecipientsStoreForTests,
  createSavedRecipient,
  deleteSavedRecipient,
  listSavedRecipients,
} from "./savedRecipientsStore";

const DATA_FILE = path.join(process.cwd(), ".data", "saved-recipients.json");

describe("savedRecipientsStore", () => {
  beforeEach(async () => {
    await __resetSavedRecipientsStoreForTests();
    try {
      await fs.unlink(DATA_FILE);
    } catch {
      // ignore missing
    }
  });

  afterEach(async () => {
    await __resetSavedRecipientsStoreForTests();
  });

  it("creates, lists (newest first), and deletes per business", async () => {
    const a = await createSavedRecipient(10, {
      label: "First",
      accountNumber: "111",
      railType: "bank",
    });
    // Ensure distinct createdAt ordering if clock is coarse
    await new Promise((r) => setTimeout(r, 5));
    const b = await createSavedRecipient(10, {
      label: "Second",
      accountNumber: "222",
      railType: "mobile",
      countryCode: "KE",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const other = await createSavedRecipient(99, {
      label: "Other biz",
      accountNumber: "999",
      railType: "bank",
    });
    expect(other.ok).toBe(true);

    const list = await listSavedRecipients(10);
    expect(list.map((r) => r.label)).toEqual(["Second", "First"]);
    expect(list.every((r) => r.businessId === 10)).toBe(true);

    expect(await deleteSavedRecipient(10, a.recipient.id)).toBe(true);
    expect(await deleteSavedRecipient(10, a.recipient.id)).toBe(false);
    expect(await deleteSavedRecipient(99, b.recipient.id)).toBe(false);

    const after = await listSavedRecipients(10);
    expect(after.map((r) => r.id)).toEqual([b.recipient.id]);
  });
});
