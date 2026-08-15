"use client";
import React, { useState } from "react";
import {
  connectStellarWallet,
  formatStellarAddress,
  getStellarDeposit,
  initialDepositState,
  previewStellarDeposit,
  stellarExplorerUrl,
  submitStellarDeposit,
  STELLAR_ASSET,
  STELLAR_NETWORK,
  STELLAR_SCENARIOS,
  STELLAR_WALLETS,
  StellarSimulationError,
  type StellarDepositState,
  type StellarScenario,
} from "@/lib/services/stellarSimulation";

/**
 * "Deposit from external wallet" — connect, pre-flight, review, approve,
 * credited.
 *
 * The chain is deliberately almost invisible: the user picks a wallet, sees
 * that it can hold USDC, confirms an amount and a reference, and approves in
 * their own wallet. No keys, seed phrases, reserves, gas or contract calls
 * appear at any point, including in the failure copy.
 */

const STAGE_ORDER = ["connect", "preflight", "review", "pending"] as const;

function StageBar({ stage }: { stage: StellarDepositState["stage"] }) {
  const reached =
    stage === "credited" ? STAGE_ORDER.length : Math.max(1, STAGE_ORDER.indexOf(stage as never) + 1);
  return (
    <div
      className="ep-money-steps"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STAGE_ORDER.length}
      aria-valuenow={reached}
      aria-label="Deposit progress"
    >
      {STAGE_ORDER.map((_, i) => (
        <span
          key={i}
          className={`ep-money-steps__dot${i < reached ? " ep-money-steps__dot--on" : ""}`}
        />
      ))}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="ep-money-review__row">
      <span className="ep-money-review__k">{label}</span>
      <span className={`ep-money-review__v${mono ? " ep-money-review__v--mono" : ""}`}>{value}</span>
    </div>
  );
}

export type ExternalWalletDepositModalProps = {
  onClose: () => void;
  /** Called once the simulated deposit is credited, so the caller can refetch. */
  onCredited?: () => void;
};

export default function ExternalWalletDepositModal({
  onClose,
  onCredited,
}: ExternalWalletDepositModalProps) {
  const [state, setState] = useState<StellarDepositState>(() => initialDepositState("happy"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const setScenario = (scenario: StellarScenario) => {
    setError(null);
    setState(initialDepositState(scenario));
    setAmount("");
  };

  /** Every adapter call funnels through here so busy/error handling is uniform. */
  const run = async (fn: () => Promise<StellarDepositState>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setState(next);
      after?.();
    } catch (err) {
      setError(
        err instanceof StellarSimulationError || err instanceof Error
          ? err.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const explorer = stellarExplorerUrl(state.txHash);

  return (
    <div className="ep-stellar-deposit">
      <StageBar stage={state.stage} />

      {/* ── 1 · Connect ─────────────────────────────────────────── */}
      {state.stage === "connect" ? (
        <div className="ep-money-stack">
          <p className="ep-money-hint">
            Choose the wallet holding your {STELLAR_ASSET}. We only request permission to read your
            address — never your keys.
          </p>
          {STELLAR_WALLETS.map((wallet) => (
            <button
              key={wallet.id}
              type="button"
              className="ep-send-method"
              disabled={busy}
              onClick={() => run(() => connectStellarWallet(state, wallet.id))}
            >
              <span className="ep-send-method__text">
                <span className="ep-send-method__label">{wallet.name}</span>
                <span className="ep-send-method__desc">{wallet.hint}</span>
              </span>
              <span className="ep-send-method__chevron" aria-hidden>
                ›
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {/* ── 2 · Pre-flight ──────────────────────────────────────── */}
      {state.stage === "preflight" ? (
        <div className="ep-money-stack">
          <span className="ep-money-step-label">Before you deposit</span>
          <div className="ep-money-review">
            <Row
              label="Wallet"
              value={`${state.walletName} · ${formatStellarAddress(state.walletAddress)}`}
              mono
            />
            <Row
              label={`${STELLAR_ASSET} ready`}
              value={
                <span style={{ color: state.trustlineReady ? "var(--success)" : "var(--amber)" }}>
                  {state.trustlineReady ? "✓ Yes" : "Not yet"}
                </span>
              }
            />
          </div>

          {!state.trustlineReady && state.error ? (
            <div className="ep-money-banner ep-money-banner--warn" role="alert">
              {state.error}
            </div>
          ) : null}

          <div className="ep-money-field">
            <label className="ep-money-label" htmlFor="stellar-amount">
              Deposit amount ({STELLAR_ASSET})
            </label>
            <input
              id="stellar-amount"
              className="ep-money-input ep-money-input--amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              disabled={!state.trustlineReady}
            />
          </div>

          <button
            type="button"
            className="ep-btn-primary"
            disabled={busy || !state.trustlineReady}
            aria-busy={busy || undefined}
            onClick={() => run(() => previewStellarDeposit(state, amount))}
          >
            {busy ? "Checking…" : "Continue"}
          </button>
        </div>
      ) : null}

      {/* ── 3 · Review ──────────────────────────────────────────── */}
      {state.stage === "review" ? (
        <div className="ep-money-stack">
          <span className="ep-money-step-label">Review deposit</span>
          <div className="ep-money-review">
            <Row label="Amount" value={`${state.amount} ${STELLAR_ASSET}`} mono />
            <Row label="Destination" value="Mboka USDC Account" />
            <Row label="Network" value={STELLAR_NETWORK} />
            <Row label="Reference" value={state.memo} mono />
          </div>
          <p className="ep-money-hint">
            You&apos;ll approve this in {state.walletName}. The reference is attached automatically.
          </p>
          <div className="ep-money-actions">
            <button
              type="button"
              className="ep-btn-secondary"
              disabled={busy}
              onClick={() => setState({ ...state, stage: "preflight" })}
            >
              Back
            </button>
            <button
              type="button"
              className="ep-btn-primary"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() =>
                run(() => submitStellarDeposit(state), () => {
                  /* moves to pending; confirmation is polled below */
                })
              }
            >
              {busy ? "Waiting for approval…" : "Approve in wallet"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── 4 · Pending confirmation ────────────────────────────── */}
      {state.stage === "pending" ? (
        <div className="ep-money-stack">
          <span className="ep-money-step-label">Confirming on {STELLAR_NETWORK}</span>
          <div className="ep-money-review">
            <Row label="Amount" value={`${state.amount} ${STELLAR_ASSET}`} mono />
            <Row label="Destination" value="Mboka USDC Account" />
            <Row label="Reference" value={state.memo} mono />
          </div>
          <div
            className={`ep-money-banner ${state.error ? "ep-money-banner--warn" : "ep-money-banner--info"}`}
            role="status"
          >
            {state.error ?? "Sent. Waiting for the network to confirm — this usually takes seconds."}
          </div>
          <button
            type="button"
            className="ep-btn-primary"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => run(() => getStellarDeposit(state), onCredited)}
          >
            {busy ? "Checking…" : "Check status"}
          </button>
        </div>
      ) : null}

      {/* ── 5 · Credited ────────────────────────────────────────── */}
      {state.stage === "credited" ? (
        <div className="ep-money-success">
          <span className="ep-money-success__title">Deposit credited</span>
          <span className="ep-money-success__body">
            {state.amount} {STELLAR_ASSET} is now available in your USDC Account.
          </span>
          {explorer ? (
            <a
              className="ep-stellar-explorer"
              href={explorer}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span aria-hidden>↗</span> View on explorer
            </a>
          ) : null}
          <button type="button" className="ep-btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      ) : null}

      {/* Held for manual review — not the user's fault, so it is not styled as
          a hard failure. */}
      {state.stage === "failed" ? (
        <div className="ep-money-stack">
          <div
            className={`ep-money-banner ${state.needsReview ? "ep-money-banner--warn" : "ep-money-banner--danger"}`}
            role="alert"
          >
            {state.error}
          </div>
          <button type="button" className="ep-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="ep-money-banner ep-money-banner--danger" role="alert">
          {error}
        </div>
      ) : null}

      {/* Demo control. Clearly fenced off so it reads as scaffolding, not
          product, and is trivial to delete with the simulation. */}
      <div className="ep-stellar-demo">
        <span className="ep-stellar-demo__label">Demo layer · simulate outcome</span>
        <div className="ep-stellar-demo__chips">
          {STELLAR_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className="ep-stellar-demo__chip"
              data-selected={state.scenario === scenario.id ? "true" : "false"}
              onClick={() => setScenario(scenario.id)}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
