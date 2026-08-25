/**
 * Share targets for settled payment receipts.
 *
 * Receipts are shared as plain text (plus optional HTML/PDF download) —
 * there is no public receipt URL yet.
 */

export type ReceiptShareDoc = {
  fileTitle: string;
  heading: string;
  statusBadge?: string;
  amount?: string;
  amountCaption?: string;
  party?: string;
  sections: { title: string; rows: { label: string; value: string }[] }[];
  footnote?: string;
};

export type ReceiptSharePayload = {
  title: string;
  text: string;
  filename: string;
};

export type ReceiptShareMethodId =
  | "device"
  | "whatsapp"
  | "email"
  | "sms"
  | "telegram"
  | "copy"
  | "pdf"
  | "html";

export type ReceiptShareMethod = {
  id: ReceiptShareMethodId;
  label: string;
  /** Short hint under the label in menus. */
  hint: string;
};

/** All share paths we surface for a receipt (order is intentional). */
export const RECEIPT_SHARE_METHODS: ReceiptShareMethod[] = [
  {
    id: "device",
    label: "Share via device",
    hint: "System share sheet (apps, AirDrop, Nearby)",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    hint: "Open a chat with the receipt summary",
  },
  {
    id: "email",
    label: "Email",
    hint: "Compose a message with the receipt",
  },
  {
    id: "sms",
    label: "Messages / SMS",
    hint: "Send the summary as a text",
  },
  {
    id: "telegram",
    label: "Telegram",
    hint: "Share the summary in Telegram",
  },
  {
    id: "copy",
    label: "Copy details",
    hint: "Copy the receipt text to clipboard",
  },
  {
    id: "pdf",
    label: "Download PDF",
    hint: "Print → Save as PDF",
  },
  {
    id: "html",
    label: "Save as file",
    hint: "Download the receipt as HTML",
  },
];

/** Flatten a branded document into a paste-friendly receipt summary. */
export function buildReceiptShareText(doc: ReceiptShareDoc): string {
  const lines: string[] = [
    doc.heading,
    doc.statusBadge ? `Status: ${doc.statusBadge}` : "",
    doc.amountCaption && doc.amount ? `${doc.amountCaption}: ${doc.amount}` : doc.amount || "",
    doc.party || "",
  ].filter(Boolean);

  for (const section of doc.sections) {
    lines.push("");
    lines.push(section.title);
    for (const row of section.rows) {
      lines.push(`${row.label}: ${row.value}`);
    }
  }

  if (doc.footnote) {
    lines.push("");
    lines.push(doc.footnote);
  }

  lines.push("");
  lines.push("— Mboka business payments");
  return lines.join("\n");
}

export function buildReceiptSharePayload(
  doc: ReceiptShareDoc,
  filenameStem: string,
): ReceiptSharePayload {
  const stem = filenameStem.replace(/\.pdf$/i, "").trim() || "mboka-receipt";
  return {
    title: doc.fileTitle || doc.heading,
    text: buildReceiptShareText(doc),
    filename: stem.endsWith(".html") ? stem : `${stem}.html`,
  };
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function emailShareUrl(title: string, text: string): string {
  return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
}

export function smsShareUrl(text: string): string {
  // iOS wants &body=, Android often accepts ?body= — dual form works widely.
  return `sms:?&body=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent("https://mboka.africa")}&text=${encodeURIComponent(text)}`;
}

export async function copyShareText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function canUseDeviceShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function shareViaDevice(payload: ReceiptSharePayload): Promise<boolean> {
  if (!canUseDeviceShare()) return false;
  try {
    await navigator.share({
      title: payload.title,
      text: payload.text,
    });
    return true;
  } catch (err) {
    // User dismissed the sheet — not a failure worth surfacing.
    if (err instanceof DOMException && err.name === "AbortError") return true;
    return false;
  }
}

export function downloadShareHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
