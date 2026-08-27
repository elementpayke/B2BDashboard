"use client";

/**
 * After a Freighter / wallet USDC payment submits on Stellar, poll Mboka for
 * the matching ElementPay account credit (by `tx_hash`) with the same backoff
 * used by `useOrderStatus`. Never invents balances — only transitions to
 * "Credited" when a credit/transaction row confirms the hash.
 */

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  accountCreditsApi,
  type AccountCredit,
} from "@/lib/services/accountCredits";
import { transactionsApi, type Transaction } from "@/lib/services/transactions";
import { nextPollIntervalMs } from "@/lib/hooks/useOrderStatus";

export type CreditWatchPhase = "submitted" | "credited" | "timed_out";

/** ~2s → 4s → … capped at 30s; stop after this many unsuccessful polls. */
export const CREDIT_WATCH_TIMEOUT_ATTEMPTS = 12;

export type MatchedCredit = {
  id: string | number;
  tx_hash: string | null;
  amount?: string | null;
  currency?: string | null;
  financial_account_id?: string | null;
};

function normalizeHash(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function findCreditByTxHash(opts: {
  txHash: string | null | undefined;
  credits: AccountCredit[];
  transactions: Transaction[];
}): MatchedCredit | null {
  const want = normalizeHash(opts.txHash);
  if (!want) return null;

  for (const credit of opts.credits) {
    if (normalizeHash(credit.tx_hash) === want) {
      return {
        id: credit.id,
        tx_hash: credit.tx_hash,
        amount: credit.amount,
        currency: credit.currency,
        financial_account_id: credit.financial_account_id,
      };
    }
  }
  for (const tx of opts.transactions) {
    if (normalizeHash(tx.tx_hash) === want) {
      return {
        id: tx.id,
        tx_hash: tx.tx_hash ?? null,
        amount: tx.amount_fiat,
        currency: tx.currency,
        financial_account_id: tx.financial_account_id ?? null,
      };
    }
  }
  return null;
}

export function nextCreditWatchPhase(opts: {
  phase: CreditWatchPhase;
  matched: MatchedCredit | null;
  attempt: number;
}): CreditWatchPhase {
  if (opts.phase === "credited" || opts.phase === "timed_out") return opts.phase;
  if (opts.matched) return "credited";
  if (opts.attempt >= CREDIT_WATCH_TIMEOUT_ATTEMPTS) return "timed_out";
  return "submitted";
}

/** Status copy aligned with Freighter “should credit shortly” / Top-up patterns. */
export function creditWatchStatusMessage(phase: CreditWatchPhase): string {
  if (phase === "credited") return "Credited";
  if (phase === "timed_out") {
    return "Payment submitted on Stellar, but ElementPay has not confirmed the credit yet. Check Activity shortly — balance updates only after confirmation.";
  }
  return "Payment submitted. It should credit shortly.";
}

export type UseStellarCreditWatchOptions = {
  enabled?: boolean;
};

export type UseStellarCreditWatchResult = {
  phase: CreditWatchPhase;
  matched: MatchedCredit | null;
  message: string;
  isFetching: boolean;
};

async function fetchCreditMatch(txHash: string): Promise<MatchedCredit | null> {
  const [creditsPage, txPage] = await Promise.all([
    accountCreditsApi.list().catch(() => ({ items: [] as AccountCredit[], total: 0 })),
    transactionsApi.list().catch(() => ({ items: [] as Transaction[], total: 0 })),
  ]);
  return findCreditByTxHash({
    txHash,
    credits: creditsPage.items,
    transactions: txPage.items,
  });
}

/**
 * Polls account-credits + transactions for `txHash` until a match, timeout, or
 * disable. On credit match, invalidates bootstrap / stablecoin / transactions
 * caches so balances refresh from the API (never from invented amounts).
 */
export function useStellarCreditWatch(
  txHash: string | null | undefined,
  options: UseStellarCreditWatchOptions = {},
): UseStellarCreditWatchResult {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const attemptRef = useRef(0);
  const phaseRef = useRef<CreditWatchPhase>("submitted");
  const matchedIdRef = useRef<string | number | null>(null);
  const hash = String(txHash ?? "").trim() || null;

  useEffect(() => {
    attemptRef.current = 0;
    phaseRef.current = "submitted";
    matchedIdRef.current = null;
  }, [hash]);

  const query = useQuery({
    queryKey: ["stellar-credit-watch", hash],
    queryFn: () => fetchCreditMatch(hash as string),
    enabled: Boolean(hash) && enabled,
    retry: false,
    refetchInterval: (q) => {
      const matched = q.state.data ?? null;
      attemptRef.current += 1;
      const next = nextCreditWatchPhase({
        phase: phaseRef.current,
        matched,
        attempt: attemptRef.current,
      });
      phaseRef.current = next;
      if (next !== "submitted") return false;
      return nextPollIntervalMs(attemptRef.current);
    },
  });

  const matched = query.data ?? null;
  const phase = nextCreditWatchPhase({
    phase: phaseRef.current,
    matched,
    attempt: attemptRef.current,
  });
  if (phase === "credited" || phase === "timed_out") {
    phaseRef.current = phase;
  }

  useEffect(() => {
    if (!matched || phase !== "credited") return;
    if (matchedIdRef.current === matched.id) return;
    matchedIdRef.current = matched.id;
    queryClient.invalidateQueries({ queryKey: ["dashboard-bootstrap"] });
    queryClient.invalidateQueries({ queryKey: ["stablecoin-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["transactions-page"] });
  }, [matched, phase, queryClient]);

  return {
    phase,
    matched: phase === "credited" ? matched : null,
    message: creditWatchStatusMessage(phase),
    isFetching: query.isFetching,
  };
}
