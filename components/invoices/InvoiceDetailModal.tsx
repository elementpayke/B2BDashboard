"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DepositAddressQr from "@/components/wallets/DepositAddressQr";
import StatusBadge from "@/components/ui/StatusBadge";
import { copyText } from "@/lib/clipboard";
import { invoicesApi, type Invoice } from "@/lib/services/invoices";
import { describeInvoiceStatus } from "@/lib/services/invoiceStatus";

function formatAmount(amount: string | number | null | undefined, asset: string): string {
  if (amount == null) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${asset}`;
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${asset}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <div className="ep-money-kv__row">
      <span className="ep-money-kv__k">{label}</span>
      <span className="ep-money-kv__v ep-mono">{value}</span>
      <button type="button" className="ep-money-copy-btn" onClick={onCopy} aria-label={`Copy ${label}`}>
        {copied ? "Copied" : "⧉ Copy"}
      </button>
    </div>
  );
}

export type InvoiceDetailModalProps = {
  invoiceId: number;
  onClose: () => void;
};

export default function InvoiceDetailModal({ invoiceId, onClose }: InvoiceDetailModalProps) {
  const invoiceQuery = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => invoicesApi.get(invoiceId),
    refetchInterval: 15_000,
  });
  const paymentsQuery = useQuery({
    queryKey: ["invoice-payments", invoiceId],
    queryFn: () => invoicesApi.payments(invoiceId),
    refetchInterval: 15_000,
  });

  const inv: Invoice | undefined = invoiceQuery.data;
  const asset = inv?.asset_code || "USDC";
  const isStellar = inv?.network === "stellar";
  const descriptor = inv ? describeInvoiceStatus(inv.status) : null;
  const payments = paymentsQuery.data?.items ?? [];

  return (
    <div className="ep-txn-detail">
      {invoiceQuery.isLoading || !inv ? (
        <div className="ep-txn-detail__loading">
          <span>Loading invoice…</span>
        </div>
      ) : (
        <>
          <div className="ep-txn-detail__hero">
            <div className="ep-txn-detail__amount">{formatAmount(inv.expected_amount, asset)}</div>
            <div className="ep-txn-detail__party">{inv.invoice_number}</div>
            <div className="ep-txn-detail__status">
              {descriptor ? (
                <StatusBadge label={descriptor.label} color={descriptor.color} soft={descriptor.soft} size="md" />
              ) : null}
            </div>
          </div>

          <div className="ep-txn-detail__rows">
            <div className="ep-txn-detail__row">
              <span className="ep-txn-detail__label">Customer</span>
              <span className="ep-txn-detail__value">
                {(inv.payload?.client_name as string) || "—"}
              </span>
            </div>
            <div className="ep-txn-detail__row">
              <span className="ep-txn-detail__label">Network</span>
              <span className="ep-txn-detail__value">
                {inv.network ? inv.network[0].toUpperCase() + inv.network.slice(1) : "—"}
              </span>
            </div>
            <div className="ep-txn-detail__row">
              <span className="ep-txn-detail__label">Amount received</span>
              <span className="ep-txn-detail__value">{formatAmount(inv.amount_received, asset)}</span>
            </div>
            <div className="ep-txn-detail__row">
              <span className="ep-txn-detail__label">Outstanding balance</span>
              <span className="ep-txn-detail__value">
                {formatAmount(inv.outstanding_balance, asset)}
              </span>
            </div>
            <div className="ep-txn-detail__row">
              <span className="ep-txn-detail__label">Created</span>
              <span className="ep-txn-detail__value">{formatDateTime(inv.created_at)}</span>
            </div>
            <div className="ep-txn-detail__row ep-txn-detail__row--last">
              <span className="ep-txn-detail__label">Expires</span>
              <span className="ep-txn-detail__value">{formatDateTime(inv.expires_at)}</span>
            </div>
          </div>

          {isStellar && inv.receiving_address && inv.status !== "paid" ? (
            <div className="ep-money-field">
              <span className="ep-money-label">Payment instructions</span>
              <DepositAddressQr
                address={inv.receiving_address}
                currency={asset}
                network="stellar"
                networkLabel="Stellar"
                amount={inv.expected_amount ?? undefined}
                memo={inv.stellar_memo ?? undefined}
              />
              <div className="ep-money-kv" role="group" aria-label="Stellar payment details">
                <CopyRow label="Receiving address" value={inv.receiving_address} />
                {inv.stellar_memo ? <CopyRow label="Memo (required)" value={inv.stellar_memo} /> : null}
              </div>
              <span className="ep-money-hint ep-money-hint--inline">
                The payer must include this memo exactly — without it we can't match their
                payment to this invoice automatically.
              </span>
            </div>
          ) : null}

          <div className="ep-activity__header">
            <h3 className="ep-activity__title">Payment history</h3>
          </div>
          {payments.length === 0 ? (
            <div className="ep-activity__empty">
              {paymentsQuery.isLoading ? "Loading…" : "No payments recorded yet."}
            </div>
          ) : (
            <ul className="ep-activity__list">
              {payments.map((p) => (
                <li key={p.id} className="ep-txn-detail__row">
                  <div className="ep-activity__party-text">
                    <span className="ep-mono ep-activity__meta">
                      {p.tx_hash.slice(0, 10)}…{p.tx_hash.slice(-6)}
                    </span>
                    <span className="ep-activity__type">
                      {formatDateTime(p.received_at)}
                      {p.is_late ? " · Late" : ""}
                    </span>
                  </div>
                  <span className="ep-mono ep-activity__amount">
                    {formatAmount(p.amount, p.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
