"use client";
import * as React from "react";
import MbokaLogo from "@/components/brand/MbokaLogo";
import { Button } from "@/components/ui/Button";
import { buildReceiptPdfBlob, downloadPdfBlob } from "@/lib/documents/receiptPdf";
import type { ReceiptShareDoc } from "@/lib/documents/receiptShare";
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

type Row = { label: string; value: string };

function buildRows(p: SendReceiptProps): { payment: Row[]; meta: Row[] } {
  return {
    payment: [
      { label: "Amount sent", value: p.amountText },
      ...(p.feeText ? [{ label: "Transfer fee", value: p.feeText }] : []),
      ...(p.rateLine ? [{ label: "Exchange rate", value: p.rateLine }] : []),
    ],
    meta: [
      { label: "Payment method", value: p.methodLabel },
      ...(p.orderId ? [{ label: "Transaction ID", value: p.orderId }] : []),
    ],
  };
}

function buildDoc(p: SendReceiptProps, paidAt: string | null): ReceiptShareDoc {
  const rows = buildRows(p);
  const pending = p.status === "processing";
  return {
    fileTitle: "Mboka payment receipt",
    heading: "Payment receipt",
    statusBadge: pending ? "Processing" : "Paid",
    statusTone: pending ? "warning" : "success",
    amount: p.getsText,
    amountCaption: pending ? "Beneficiary will receive" : "Received by beneficiary",
    party: [p.recipientName, ...p.toLines].filter(Boolean).join(" · "),
    sections: [
      {
        title: "Payment",
        rows: [...rows.payment, { label: "Total debited", value: p.totalText }, ...rows.meta],
      },
    ],
    ...(paidAt ? { dateLine: paidAt } : {}),
  };
}

function buildText(p: SendReceiptProps, paidAt: string | null): string {
  const rows = buildRows(p);
  return [
    `Mboka payment receipt${p.orderId ? ` ${p.orderId}` : ""}`,
    ...(paidAt ? [paidAt] : []),
    `${p.getsText} to ${p.recipientName || "recipient"}`,
    ...p.toLines,
    `From: ${p.sourceLabel}`,
    ...[...rows.payment, { label: "Total debited", value: p.totalText }, ...rows.meta].map(
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
  const paidAt = formatPaidAt(p.paidAt);
  const pending = p.status === "processing";
  const rows = buildRows(p);
  const filename = `mboka-receipt${p.orderId ? `-${p.orderId}` : ""}`;

  const download = () => {
    const pdf = buildReceiptPdfBlob(buildDoc(p, paidAt), filename);
    downloadPdfBlob(pdf.blob, pdf.filename);
    setNote("PDF saved");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildText(p, paidAt));
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
          <div className="min-w-56 flex-1 desktop:flex-none">
            <h1
              id="send-flow-title"
              className="mb-2 text-right font-display text-headline font-bold tracking-title"
            >
              Payment receipt
            </h1>
            <dl>
              {p.orderId ? <HeadRow label="Receipt no.">{p.orderId}</HeadRow> : null}
              {paidAt ? <HeadRow label="Date">{paidAt}</HeadRow> : null}
              <HeadRow label="Status">
                <span className={cn("font-medium", pending ? "text-warning-text" : "text-link")}>
                  {pending ? "Processing" : "Completed"}
                </span>
              </HeadRow>
            </dl>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-6 border-b border-border py-5">
          <div className="min-w-0">
            <SectionLabel>From</SectionLabel>
            <p className="mt-1.5 text-title font-bold">{p.sourceLabel}</p>
          </div>
          <div className="min-w-0">
            <SectionLabel>To</SectionLabel>
            <p className="mt-1.5 text-title font-bold">{p.recipientName || "Recipient"}</p>
            {p.toLines.map((line) => (
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
            {rows.payment.map((row) => (
              <div key={row.label} className="flex justify-between gap-5 border-b border-border py-2.5 text-body-lg">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-mono">{row.value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-5 border-b border-border py-3 text-title font-bold">
              <dt>Total debited</dt>
              <dd className="font-mono font-medium">{p.totalText}</dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-5 bg-background px-4 py-3.5 text-title font-bold">
              <dt>{pending ? "Amount beneficiary will receive" : "Amount received by beneficiary"}</dt>
              <dd className="text-right font-mono text-headline font-medium">{p.getsText}</dd>
            </div>
          </dl>
        </div>

        <dl className="border-b border-border py-3.5">
          {rows.meta.map((row) => (
            <div key={row.label} className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-4 py-1 text-body-lg">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className={cn("break-words", row.label === "Transaction ID" && "font-mono")}>{row.value}</dd>
            </div>
          ))}
        </dl>

        <footer className="pt-4 text-caption leading-relaxed text-muted-foreground">
          <p>
            {pending
              ? "This payment is still processing. This receipt confirms the payment instruction and does not confirm delivery to the beneficiary."
              : "This receipt was generated electronically and is valid without a signature."}
          </p>
          <p className="mt-1.5">Mboka is a product of ElementPay</p>
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
