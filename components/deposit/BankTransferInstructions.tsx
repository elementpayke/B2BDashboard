"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { bankInstructionsText, type BankInstructionRow } from "@/lib/services/transferTerms";

type Props = {
  /** Exact amount to send, already formatted (e.g. "5,000"). */
  amount: string;
  currency: string;
  /** Instruction rows from the accepted order (account number, bank, …, Reference, Expires). */
  rows: BankInstructionRow[];
  /** e.g. "Arrives within minutes" — from the rail, never invented. */
  arrival: string;
  /** Live order status, when known. */
  status?: { label: string; color: string; soft: string } | null;
  onSent: () => void;
};

const HIDDEN_KEYS = new Set(["amount", "reference", "expires"]);

function Icon({ name }: { name: "copy" | "check" | "share" | "download" | "clock" }) {
  const paths: Record<typeof name, string[]> = {
    copy: ["M9 9h11v11H9z", "M5 15V5a1 1 0 011-1h10"],
    check: ["M5 12.5l4.5 4.5L19 7.5"],
    share: ["M12 3v12", "M7.5 7.5L12 3l4.5 4.5", "M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6"],
    download: ["M12 3v12", "M7.5 10.5L12 15l4.5-4.5", "M5 20h14"],
    clock: ["M12 7v5l3 2", "M3.5 12a8.5 8.5 0 1017 0 8.5 8.5 0 00-17 0z"],
  };
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      {paths[name].map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/**
 * Bank-transfer top-up: what to pay, where, and the one detail people get
 * wrong (the reference). Every value copies on its own; "Copy all" grabs the
 * lot for pasting into a bank app or sending to a finance colleague.
 */
export default function BankTransferInstructions({ amount, currency, rows, arrival, status, onSent }: Props) {
  const [copied, setCopied] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const reference = rows.find((r) => r.k.toLowerCase() === "reference")?.v || "";
  const expires = rows.find((r) => r.k.toLowerCase() === "expires")?.v || "";
  const details = rows.filter((r) => !HIDDEN_KEYS.has(r.k.toLowerCase()));
  const amountLabel = `${currency} ${amount}`.trim();
  const allText = bankInstructionsText({ amount, currency, rows: rows.filter((r) => r.k.toLowerCase() !== "amount"), arrival });

  const copy = async (key: string, value: string) => {
    if (!(await copyText(value))) return;
    setCopied(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(""), 1600);
  };

  const download = () => {
    const blob = new Blob([allText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mboka-bank-transfer-instructions.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copyButton = (key: string, value: string, label: string) => (
    <button
      type="button"
      className="ep-bank-pay__copy"
      data-copied={copied === key ? "true" : "false"}
      onClick={() => void copy(key, value)}
      aria-label={copied === key ? `${label} copied` : `Copy ${label}`}
    >
      <Icon name={copied === key ? "check" : "copy"} />
      <span>{copied === key ? "Copied" : "Copy"}</span>
    </button>
  );

  return (
    <section className="ep-bank-pay" aria-label="Bank transfer instructions">
      <header className="ep-bank-pay__head">
        <span className="ep-bank-pay__eyebrow">Send from your bank</span>
        <div className="ep-bank-pay__amount-row">
          <span className="ep-bank-pay__amount">
            Pay exactly <b className="ep-bank-pay__amount-value">{amountLabel}</b>
          </span>
          {copyButton("amount", amount.replace(/,/g, ""), "amount")}
        </div>
        <div className="ep-bank-pay__chips">
          {arrival ? (
            <span className="ep-bank-pay__chip">
              <Icon name="clock" />
              {arrival}
            </span>
          ) : null}
          {expires ? <span className="ep-bank-pay__chip ep-bank-pay__chip--warn">Pay before {expires}</span> : null}
          {status ? (
            <span className="ep-bank-pay__chip" style={{ background: status.soft, color: status.color }} role="status">
              {status.label}
            </span>
          ) : null}
        </div>
      </header>

      <ol className="ep-bank-pay__steps">
        <li>Open your bank app or internet banking.</li>
        <li>Pay the exact amount to the account below.</li>
        <li>Add the reference — it&apos;s how we match the payment to you.</li>
      </ol>

      <div className="ep-bank-pay__details" role="group" aria-label="Account details">
        {details.map((r) => (
          <div key={r.k} className="ep-bank-pay__row">
            <span className="ep-bank-pay__row-text">
              <span className="ep-bank-pay__label">{r.k}</span>
              <span className="ep-bank-pay__value">{r.v}</span>
            </span>
            {copyButton(`row:${r.k}`, r.v, r.k)}
          </div>
        ))}
      </div>

      {reference ? (
        <div className="ep-bank-pay__ref">
          <span className="ep-bank-pay__row-text">
            <span className="ep-bank-pay__label">Reference · required</span>
            <span className="ep-bank-pay__ref-value">{reference}</span>
          </span>
          {copyButton("reference", reference, "reference")}
          <p className="ep-bank-pay__ref-note">
            Put this in the payment reference or narration field. Without it we can&apos;t match the
            payment to your account automatically.
          </p>
        </div>
      ) : null}

      <p className="ep-bank-pay__note">
        Send from a {currency} account in your business&apos;s name. Payments from other people&apos;s
        accounts may be returned.
      </p>

      <div className="ep-bank-pay__tools">
        <button type="button" className="ep-bank-pay__tool" onClick={() => void copy("all", allText)}>
          <Icon name={copied === "all" ? "check" : "copy"} />
          {copied === "all" ? "Copied" : "Copy all"}
        </button>
        {canShare ? (
          <button
            type="button"
            className="ep-bank-pay__tool"
            onClick={() => navigator.share?.({ title: "Bank transfer instructions", text: allText }).catch(() => {})}
          >
            <Icon name="share" />
            Share
          </button>
        ) : null}
        <button type="button" className="ep-bank-pay__tool" onClick={download}>
          <Icon name="download" />
          Download
        </button>
      </div>

      <button type="button" className="ep-btn-primary ep-bank-pay__sent" onClick={onSent}>
        I&apos;ve sent it
      </button>
      <p className="ep-bank-pay__after">We&apos;ll update this top-up in Transactions as soon as it lands.</p>
    </section>
  );
}
