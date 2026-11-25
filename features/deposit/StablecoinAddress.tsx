"use client";
import * as React from "react";
import { ChoiceChip, Notice } from "@/components/patterns/flow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import DepositAddressQr from "@/components/wallets/DepositAddressQr";
import { copyText } from "@/lib/clipboard";
import { settlesAsUsdcOnStellar } from "@/lib/config/stellarFeatures";
import { useStellarWalletDeposit } from "@/lib/hooks/useStellarWalletDeposit";
import { isStellarNetwork, shouldOfferStellarWalletDeposit, truncateStellarAddress } from "@/lib/stellar/network";
import { cn } from "@/lib/utils";

export type StablecoinAddressProps = {
  assetCode: string;
  networkKey: string;
  networkLabel: string;
  address: string;
  addressEmptyMessage?: string;
  createAccount?: (() => void) | null;
  createAccountLabel?: string;
  intoLabel: string;
  onChangeNetwork: () => void;
  onDone: () => void;
};

const PHASE_STEPS = ["Sent", "Arriving", "Credited"] as const;

function phaseIndex(phase: string): number {
  if (phase === "credited") return 2;
  if (phase === "processing" || phase === "timed_out") return 1;
  return 0;
}

/** Deposit address for a stablecoin rail, with Stellar wallet connect where it works. */
export default function StablecoinAddress(p: StablecoinAddressProps) {
  const stellar = isStellarNetwork(p.networkKey);
  const hasAddress = Boolean(p.address && p.address !== "—");
  const walletOffered = hasAddress && shouldOfferStellarWalletDeposit({ network: p.networkKey, currency: p.assetCode, destination: p.address });
  const wallet = useStellarWalletDeposit({ destination: p.address, network: p.networkKey });
  const [memo, setMemo] = React.useState("");
  const [copy, setCopy] = React.useState<"idle" | "copied" | "failed">("idle");
  const settlesAsUsdc = settlesAsUsdcOnStellar(p.assetCode, p.networkKey);

  const copyAddress = async () => setCopy((await copyText(p.address)) ? "copied" : "failed");

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          <ChoiceChip label="coin and network" onChange={p.onChangeNetwork}>
            {p.assetCode} on {p.networkLabel}
          </ChoiceChip>
        </div>
        <h1
          id="deposit-flow-title"
          className="font-display text-page font-bold leading-heading tracking-display text-foreground desktop:text-hero"
        >
          Send {p.assetCode} on {p.networkLabel} here
        </h1>
        <p className="text-lead leading-body text-muted-foreground desktop:text-title">
          {walletOffered
            ? "Connect your Stellar wallet, or scan or copy the address."
            : `Scan or copy from any wallet or exchange. Credits your ${p.intoLabel} after processing.`}
        </p>
      </div>

      {!hasAddress ? (
        <EmptyState
          tone="error"
          title={p.addressEmptyMessage || "No deposit address on this network yet."}
          action={
            p.createAccount ? (
              <Button onClick={p.createAccount}>{p.createAccountLabel || "Create stablecoin account"}</Button>
            ) : null
          }
        />
      ) : (
        <section
          aria-label={`${p.assetCode} on ${p.networkLabel} deposit`}
          className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5"
        >
          {stellar ? (
            <div className="grid gap-3 desktop:grid-cols-2">
              <Field label="Amount (optional)">
                <Input mono inputMode="decimal" placeholder="0.00" value={wallet.amount} onChange={(e) => wallet.setAmount(e.target.value)} />
              </Field>
              <Field label="Reference memo (optional)" hint="For your own records. Not needed to arrive.">
                <Input mono maxLength={28} placeholder="e.g. invoice-42" value={memo} onChange={(e) => setMemo(e.target.value)} />
              </Field>
            </div>
          ) : null}

          {walletOffered ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
              {!wallet.address ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-title font-bold text-foreground">Pay from your Stellar wallet</h2>
                    <p className="text-body-lg text-muted-foreground">Freighter, LOBSTR, xBull and others</p>
                  </div>
                  <Button className="rounded-pill px-5" loading={wallet.busy === "connect"} onClick={() => void wallet.connect()}>
                    Connect wallet
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-body-lg font-bold text-foreground">Wallet connected</p>
                      <p className="font-mono text-body-lg text-muted-foreground">{truncateStellarAddress(wallet.address)}</p>
                    </div>
                    <Button variant="secondary" size="sm" className="min-h-11" onClick={() => void wallet.disconnect()}>
                      Disconnect
                    </Button>
                  </div>
                  {wallet.hash ? (
                    <div role="status" className="flex flex-col gap-2.5">
                      <ol className="grid grid-cols-3 gap-2 text-body font-bold">
                        {PHASE_STEPS.map((label, i) => (
                          <li
                            key={label}
                            className={cn(
                              "rounded-md px-2.5 py-2",
                              i < phaseIndex(wallet.phase) || wallet.phase === "credited"
                                ? "bg-accent text-accent-foreground"
                                : i === phaseIndex(wallet.phase)
                                  ? "bg-warning-tint text-warning-text"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {label}
                          </li>
                        ))}
                      </ol>
                      <p className="text-body-lg text-muted-foreground">{wallet.message}</p>
                      <div className="flex flex-wrap gap-3">
                        {wallet.explorerUrl ? (
                          <Button variant="link" asChild>
                            <a href={wallet.explorerUrl} target="_blank" rel="noopener noreferrer">
                              View on explorer
                            </a>
                          </Button>
                        ) : null}
                        <Button variant="link" onClick={wallet.reset}>
                          Send another
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-body text-muted-foreground">
                        Your wallet asks you to approve the payment. Nothing moves until you do.
                      </p>
                      {wallet.amountHint && wallet.amount.trim() ? (
                        <p className="text-caption text-destructive-text">{wallet.amountHint}</p>
                      ) : null}
                      <Button
                        className="self-start rounded-pill px-6"
                        disabled={!wallet.canSend}
                        loading={wallet.busy === "send"}
                        onClick={() => void wallet.send()}
                      >
                        {wallet.amount.trim() ? `Send ${wallet.amount} USDC` : "Send USDC"}
                      </Button>
                    </>
                  )}
                </div>
              )}
              {wallet.error ? <Notice tone="danger">{wallet.error}</Notice> : null}
              <div aria-hidden className="flex items-center gap-3 text-dense text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or send it yourself
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-4 desktop:flex-row desktop:items-start">
            <div className="w-44 shrink-0">
              <DepositAddressQr
                address={p.address}
                currency={p.assetCode}
                network={p.networkKey}
                networkLabel={p.networkLabel}
                amount={stellar ? wallet.amount : undefined}
                memo={stellar ? memo : undefined}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-dense text-muted-foreground">Address · {p.networkLabel} network</span>
              <span className="break-all font-mono text-lead text-foreground">{p.address}</span>
              <Button variant={walletOffered ? "secondary" : "primary"} className="self-start rounded-pill px-5" onClick={() => void copyAddress()}>
                Copy address
              </Button>
              <span role="status" aria-live="polite" className="text-caption text-muted-foreground">
                {copy === "copied" ? "Copied" : copy === "failed" ? "Couldn't copy. Select the address and copy it." : ""}
              </span>
            </div>
          </div>

          <Notice tone="warning" role="note">
            Only send {p.assetCode} on {p.networkLabel} to this address. Coins on other networks sent here can’t be
            recovered.{settlesAsUsdc ? ` ${p.assetCode} sent here settles as USDC after it arrives.` : ""}
          </Notice>

          <p role="status" className="flex items-center gap-2.5 border-t border-border pt-3 text-body-lg text-muted-foreground">
            <span aria-hidden className="size-2 rounded-pill bg-primary" />
            We’re watching this address. Deposits show in Transactions as they arrive.
          </p>
        </section>
      )}

      <div className="flex justify-center gap-2.5">
        <Button variant="secondary" className="rounded-pill px-5" onClick={p.onChangeNetwork}>
          <span aria-hidden>←</span> Back
        </Button>
        <Button variant="secondary" className="rounded-pill px-8" onClick={p.onDone}>
          Done
        </Button>
      </div>
    </>
  );
}
