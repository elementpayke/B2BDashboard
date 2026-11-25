"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { QK } from "@/lib/api/queryKeys";
import { nextPollIntervalMs } from "@/lib/orderStatusPolling";
import {
  isTerminalPaymentRequestStatus,
  paymentRequestsApi,
  type PaymentRequest,
  type PaymentRequestCreatePayload,
} from "@/lib/services/paymentRequests";

/** Where an Interac / open-banking request stands, in the flow's words. */
export type PaymentRequestStage = "waiting" | "received" | "failed";

export function paymentRequestStage(status: string | null | undefined): PaymentRequestStage {
  const s = (status || "").trim().toLowerCase();
  if (s === "settled") return "received";
  if (isTerminalPaymentRequestStatus(s)) return "failed";
  return "waiting";
}

export function newPaymentRequestRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `pr-${crypto.randomUUID()}`;
  return `pr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function returnUrl(): string {
  if (typeof window === "undefined") return "https://app.elementpay.net/wallets";
  return `${window.location.origin}/wallets?fund=return`;
}

/**
 * Create a payment request on an account and track it until it settles or fails.
 *
 * `client_ref` is minted once per request the user means to send and reused if
 * they press Send again after an error, so a retry can't create a second
 * request (Aggregator treats it as the unique reference).
 */
export function usePaymentRequest(entityId: string, accountId: string) {
  const queryClient = useQueryClient();
  const refRef = useRef<string | null>(null);
  const attemptRef = useRef(0);

  const create = useMutation({
    mutationFn: (input: Omit<PaymentRequestCreatePayload, "client_ref" | "redirect_url">) => {
      refRef.current ??= newPaymentRequestRef();
      return paymentRequestsApi.create(entityId, accountId, {
        ...input,
        client_ref: refRef.current,
        redirect_url: returnUrl(),
      });
    },
  });

  const created: PaymentRequest | undefined = create.data;
  const status = useQuery({
    queryKey: [QK.paymentRequest, entityId, accountId, created?.id],
    queryFn: () => paymentRequestsApi.get(entityId, accountId, String(created?.id)),
    enabled: Boolean(created?.id) && !isTerminalPaymentRequestStatus(created?.status),
    initialData: created,
    retry: false,
    staleTime: 0,
    refetchIntervalInBackground: true,
    refetchInterval: (q) => {
      if (isTerminalPaymentRequestStatus(q.state.data?.status)) return false;
      attemptRef.current += 1;
      return nextPollIntervalMs(attemptRef.current);
    },
  });

  const request = status.data ?? created;
  const stage = request ? paymentRequestStage(request.status) : null;

  useEffect(() => {
    if (stage !== "received") return;
    for (const root of [QK.depositAccounts, QK.dashboardBootstrap, QK.dashboardSummary, QK.transactions, QK.transactionsPage]) {
      void queryClient.invalidateQueries({ queryKey: [root] });
    }
  }, [stage, queryClient]);

  return {
    send: create.mutate,
    sending: create.isPending,
    error: create.error ? (create.error as Error).message || "Couldn’t send the request. Try again." : null,
    request: request ?? null,
    stage,
    /** Start a fresh request (new reference) after one failed or settled. */
    reset: () => {
      refRef.current = null;
      attemptRef.current = 0;
      create.reset();
    },
  };
}
