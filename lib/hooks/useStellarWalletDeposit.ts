"use client";

import { useMemo, useState } from "react";
import { useStellarCreditWatch, type CreditWatchPhase } from "@/lib/hooks/useStellarCreditWatch";
import { parseStellarAmount } from "@/lib/stellar/amount";
import { formatStellarWalletError, isWalletModalClosed } from "@/lib/stellar/errors";
import { resolveStellarNetwork, stellarExplorerTxUrl } from "@/lib/stellar/network";
import { sendStellarUsdc } from "@/lib/stellar/sendUsdc";
import {
  connectStellarWallet,
  disconnectStellarWallet,
  signStellarTransaction,
} from "@/lib/stellar/walletKit";

export type StellarWalletDepositState = {
  /** Connected wallet's G… address, null until connected. */
  address: string | null;
  amount: string;
  setAmount: (value: string) => void;
  busy: "connect" | "send" | null;
  error: string | null;
  /** Hash of the submitted payment, null until sent. */
  hash: string | null;
  canSend: boolean;
  /** Why the typed amount can't be sent, when it can't. */
  amountHint: string | null;
  explorerUrl: string | null;
  /** Where the credit stands after sending. */
  phase: CreditWatchPhase;
  message: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: () => Promise<void>;
  /** Clears the sent payment so another can be sent. */
  reset: () => void;
};

/**
 * Pay a Stellar USDC deposit address from the user's own wallet (Freighter,
 * LOBSTR, xBull … via Stellar Wallets Kit), then watch for ElementPay's credit.
 */
export function useStellarWalletDeposit(opts: {
  destination: string;
  network: string;
  suggestedAmount?: string;
}): StellarWalletDepositState {
  const { destination, network, suggestedAmount = "" } = opts;
  const config = useMemo(() => resolveStellarNetwork(network), [network]);
  const [address, setAddress] = useState<string | null>(null);
  const [amount, setAmountRaw] = useState(suggestedAmount);
  const [busy, setBusy] = useState<"connect" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  // Follow a new suggested amount from the parent (render-time sync, no effect).
  const [lastSuggested, setLastSuggested] = useState(suggestedAmount);
  if (lastSuggested !== suggestedAmount) {
    setLastSuggested(suggestedAmount);
    setAmountRaw(suggestedAmount);
  }

  const creditWatch = useStellarCreditWatch(hash, { enabled: Boolean(hash) });
  const parsed = parseStellarAmount(amount);

  const connect = async () => {
    setError(null);
    setBusy("connect");
    try {
      setAddress(await connectStellarWallet(config));
    } catch (err) {
      if (!isWalletModalClosed(err)) {
        setError(formatStellarWalletError(err) || "Could not connect a Stellar wallet.");
      }
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setError(null);
    try {
      await disconnectStellarWallet();
    } catch {
      /* still clear the local session */
    }
    setAddress(null);
    setHash(null);
  };

  const send = async () => {
    if (!address || !parsed.ok) return;
    setError(null);
    setBusy("send");
    try {
      const result = await sendStellarUsdc({
        config,
        fromAddress: address,
        toAddress: destination,
        amountRaw: amount,
        signXdr: (xdr) => signStellarTransaction(config, xdr, address),
      });
      setHash(result.hash);
    } catch (err) {
      if (!isWalletModalClosed(err)) setError(formatStellarWalletError(err));
    } finally {
      setBusy(null);
    }
  };

  return {
    address,
    amount,
    setAmount: (value) => setAmountRaw(value.replace(/[^\d.]/g, "")),
    busy,
    error,
    hash,
    canSend: Boolean(address) && parsed.ok && !busy && !hash,
    amountHint: parsed.error ?? null,
    explorerUrl: hash ? stellarExplorerTxUrl({ txHash: hash, isTestnet: config.isTestnet }) : null,
    phase: creditWatch.phase,
    message: creditWatch.message,
    connect,
    disconnect,
    send,
    reset: () => setHash(null),
  };
}
