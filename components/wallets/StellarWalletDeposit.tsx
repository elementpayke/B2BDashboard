"use client";

import React from "react";
import { useStellarWalletDeposit } from "@/lib/hooks/useStellarWalletDeposit";
import { truncateStellarAddress } from "@/lib/stellar/network";

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
  const w = useStellarWalletDeposit({ destination, network, suggestedAmount });
  const { address, amount, busy, error, hash, canSend, amountHint, explorerUrl, connect, disconnect, send } = w;
  const creditWatch = { message: w.message };
  const setAmount = w.setAmount;
  const setHash = (_: null) => w.reset();

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
              onChange={(e) => setAmount(e.target.value)}
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
          {creditWatch.message}{" "}
          {explorerUrl ? (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
              View on explorer
            </a>
          ) : null}
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

      {amountHint && amount.trim() && address && !hash ? (
        <p className="ep-fund-sc__hint">{amountHint}</p>
      ) : null}
    </div>
  );
}
