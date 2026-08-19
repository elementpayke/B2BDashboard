"use client";

import React, { useEffect, useMemo, useState } from "react";
import { parseStellarAmount } from "@/lib/stellar/amount";
import { formatStellarWalletError, isWalletModalClosed } from "@/lib/stellar/errors";
import { resolveStellarNetwork, truncateStellarAddress } from "@/lib/stellar/network";
import { sendStellarUsdc } from "@/lib/stellar/sendUsdc";
import {
  connectStellarWallet,
  disconnectStellarWallet,
  signStellarTransaction,
} from "@/lib/stellar/walletKit";

export type StellarWalletDepositProps = {
  destination: string;
  network: string;
  suggestedAmount: string;
};

export default function StellarWalletDeposit({
  destination,
  network,
  suggestedAmount,
}: StellarWalletDepositProps) {
  const config = useMemo(() => resolveStellarNetwork(network), [network]);
  const [address, setAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState(suggestedAmount);

  useEffect(() => {
    setAmount(suggestedAmount);
  }, [suggestedAmount]);
  const [busy, setBusy] = useState<"connect" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  const parsed = parseStellarAmount(amount);
  const canSend = Boolean(address) && parsed.ok && !busy && !hash;

  const connect = async () => {
    setError(null);
    setBusy("connect");
    try {
      const next = await connectStellarWallet(config);
      setAddress(next);
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
      /* still clear local session */
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
      if (!isWalletModalClosed(err)) {
        setError(formatStellarWalletError(err));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ep-fund-sc__wallet">
      <div className="ep-fund-sc__wallet-kicker">Or send from a wallet</div>
      <p className="ep-fund-sc__body">
        Connect Freighter, LOBSTR, xBull, or another Stellar wallet to deposit USDC without
        copying the address.
      </p>

      {address ? (
        <div className="ep-fund-sc__wallet-row">
          <span className="ep-fund-sc__wallet-addr ep-mono" title={address}>
            {truncateStellarAddress(address)}
          </span>
          <button type="button" className="ep-fund-sc__btn-secondary" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="ep-fund-sc__btn-primary"
          onClick={connect}
          disabled={busy === "connect"}
        >
          {busy === "connect" ? "Connecting…" : "Connect wallet"}
        </button>
      )}

      {address && !hash ? (
        <div className="ep-fund-sc__amount-block">
          <label className="ep-fund-sc__amount-label" htmlFor="fund-sc-wallet-amount">
            Amount to send
          </label>
          <div className="ep-fund-sc__amount-input-wrap">
            <span className="ep-fund-sc__amount-prefix" aria-hidden>
              USDC
            </span>
            <input
              id="fund-sc-wallet-amount"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="ep-fund-sc__amount-input"
            />
          </div>
          <button
            type="button"
            className="ep-fund-sc__btn-primary"
            onClick={send}
            disabled={!canSend}
          >
            {busy === "send" ? "Sending…" : "Send from wallet"}
          </button>
        </div>
      ) : null}

      {hash ? (
        <div className="ep-fund-sc__wallet-ok" role="status">
          Payment submitted. It should credit shortly.{" "}
          <a
            href={
              config.isTestnet
                ? `https://stellar.expert/explorer/testnet/tx/${hash}`
                : `https://stellar.expert/explorer/public/tx/${hash}`
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            View on explorer
          </a>
          <button type="button" className="ep-fund-sc__btn-secondary" onClick={() => setHash(null)}>
            Send another
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="ep-fund-sc__warn" role="alert">
          {error}
        </div>
      ) : null}

      {!parsed.ok && amount.trim() && address && !hash ? (
        <p className="ep-fund-sc__hint">{parsed.error}</p>
      ) : null}
    </div>
  );
}
