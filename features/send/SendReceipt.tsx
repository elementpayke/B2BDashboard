"use client";
import * as React from "react";
import MbokaLogo from "@/components/brand/MbokaLogo";
import { Button } from "@/components/ui/Button";
import { downloadPdfBlob } from "@/lib/documents/receiptPdf";
import { buildSendReceiptPdf, type SendReceiptDoc } from "@/lib/documents/sendReceiptPdf";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./parts";

export type SendReceiptProps = {
  /** "processing" receipts confirm the instruction only, not delivery. */
  status: "delivered" | "processing";
  /** What the recipient gets, e.g. "64600.00 KES". */
  getsText: string;
  recipientName: string;
  /** Lines under the recipient's name: provider and country, then the account. */
  toLines: string[];
  /** Balance the money left, e.g. "USDT · Polygon". */
  sourceLabel: string;
  /** "Bank transfer", "Mobile money" or "Stablecoin". */
  methodLabel: string;
  /** ISO timestamp of the last order update, when known. */
  paidAt: string | null;
  amountText: string;
  feeText: string | null;
  rateLine: string | null;
  /** Where it was paid out: "M-Pesa", "KCB Bank", "Polygon". */
  channelText?: string | null;
  /** The account exactly as the user entered it. */
  accountText?: string | null;
  totalText: string;
  orderId: string | null;
  onBack: () => void;
};

function formatPaidAt(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** One model for the screen and the PDF, so the two can't drift apart. */
function buildDoc(p: SendReceiptProps): SendReceiptDoc {
  const pending = p.status === "processing";
  return {
    pending,
    orderId: p.orderId,
    paidAt: formatPaidAt(p.paidAt),
    statusText: pending ? "Processing" : "Completed",
    sourceLabel: p.sourceLabel,
    recipientName: p.recipientName,
    toLines: p.toLines,
    rows: [
      ...(p.channelText ? [{ label: "Channel", value: p.channelText }] : []),
      ...(p.accountText ? [{ label: "Account", value: p.accountText }] : []),
      { label: "Amount sent", value: p.amountText },
      ...(p.feeText ? [{ label: "Transfer fee", value: p.feeText }] : []),
      ...(p.rateLine ? [{ label: "Exchange rate", value: p.rateLine }] : []),
    ],
    totalText: p.totalText,
    getsLabel: pending ? "Amount beneficiary will receive" : "Amount received by beneficiary",
    getsText: p.getsText,
    meta: [
      { label: "Payment method", value: p.methodLabel },
      ...(p.orderId ? [{ label: "Transaction ID", value: p.orderId, mono: true }] : []),
    ],
    footnote: pending
      ? "This payment is still processing. This receipt confirms the payment instruction and does not confirm delivery to the beneficiary."
      : "This receipt was generated electronically and is valid without a signature.",
    credit: "Mboka is a product of ElementPay",
  };
}

function buildText(d: SendReceiptDoc): string {
  return [
    `Mboka payment receipt${d.orderId ? ` ${d.orderId}` : ""}`,
    ...(d.paidAt ? [d.paidAt] : []),
    `${d.getsText} to ${d.recipientName || "recipient"}`,
    ...d.toLines,
    `From: ${d.sourceLabel}`,
    ...[...d.rows, { label: "Total debited", value: d.totalText }, ...d.meta].map(
      (row) => `${row.label}: ${row.value}`,
    ),
  ].join("\n");
}

function HeadRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-body">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-foreground">{children}</dd>
    </div>
  );
}

/** The payment laid out as a document a supplier or accountant can file. */
export default function SendReceipt(p: SendReceiptProps) {
  const [note, setNote] = React.useState("");
  const d = buildDoc(p);
  const filename = `mboka-receipt${p.orderId ? `-${p.orderId}` : ""}`;

  const download = async () => {
    setNote("Preparing PDF…");
    try {
      const pdf = await buildSendReceiptPdf(d, filename);
      downloadPdfBlob(pdf.blob, pdf.filename);
      setNote("PDF saved");
    } catch {
      setNote("Couldn’t create the PDF");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildText(d));
      setNote("Details copied");
    } catch {
      setNote("Couldn’t copy the details");
    }
  };

  return (
    <section
      data-slot="send-receipt"
      aria-labelledby="send-flow-title"
      className="mx-auto flex w-full max-w-145 flex-col gap-4"
    >
      <article
        aria-label="Payment receipt"
        className="rounded-xs border border-border bg-card px-6 pb-7 pt-8 text-foreground desktop:px-10"
      >
        <header className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-foreground pb-5">
          <MbokaLogo size={28} />
          <div className="min-w-56 flex-1">
            <h1
              id="send-flow-title"
              className="mb-2 text-right font-display text-headline font-bold tracking-title"
            >
              Payment receipt
            </h1>
            <dl>
              {d.orderId ? <HeadRow label="Receipt no.">{d.orderId}</HeadRow> : null}
              {d.paidAt ? <HeadRow label="Date">{d.paidAt}</HeadRow> : null}
              <HeadRow label="Status">
                <span className={cn("font-medium", d.pending ? "text-warning-text" : "text-link")}>
                  {d.statusText}
                </span>
              </HeadRow>
            </dl>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-6 border-b border-border py-5">
          <div className="min-w-0">
            <SectionLabel>From</SectionLabel>
            <p className="mt-1.5 text-title font-bold">{d.sourceLabel}</p>
          </div>
          <div className="min-w-0">
            <SectionLabel>To</SectionLabel>
            <p className="mt-1.5 text-title font-bold">{d.recipientName || "Recipient"}</p>
            {d.toLines.map((line) => (
              <p key={line} className="break-words text-body-lg leading-body text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="pt-3.5">
          <div className="flex justify-between border-b border-border pb-2 pt-1.5">
            <SectionLabel>Description</SectionLabel>
            <SectionLabel>Amount</SectionLabel>
          </div>
          <dl>
            {d.rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-5 border-b border-border py-2.5 text-body-lg">
                <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 break-words text-right font-mono">{row.value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-5 border-b border-border py-3 text-title font-bold">
              <dt>Total debited</dt>
              <dd className="font-mono font-medium">{d.totalText}</dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-5 bg-background px-4 py-3.5 text-title font-bold">
              <dt>{d.getsLabel}</dt>
              <dd className="text-right font-mono text-headline font-medium">{d.getsText}</dd>
            </div>
          </dl>
        </div>

        <dl className="border-b border-border py-3.5">
          {d.meta.map((row) => (
            <div key={row.label} className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-4 py-1 text-body-lg">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className={cn("break-words", row.mono && "font-mono")}>{row.value}</dd>
            </div>
          ))}
        </dl>

        <footer className="pt-4 text-caption leading-relaxed text-muted-foreground">
          <p>{d.footnote}</p>
          <p className="mt-1.5">{d.credit}</p>
        </footer>
      </article>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" className="rounded-pill" onClick={copy}>
          Copy details
        </Button>
        <Button className="rounded-pill" onClick={download}>
          Download PDF
        </Button>
      </div>
      <Button variant="link" className="self-center" onClick={p.onBack}>
        Close receipt
      </Button>
      <p role="status" aria-live="polite" className="min-h-5 text-center text-dense text-muted-foreground">
        {note}
      </p>
    </section>
  );
}
