"use client";

import { useQuery } from "@tanstack/react-query";
import { StrKey } from "@stellar/stellar-sdk";
import { fetchStellarWalletPayments, type OnchainWalletPayment } from "@/lib/stellar/walletPayments";
import { isStellarUsdcRail, resolveStellarNetwork } from "@/lib/stellar/network";

export type UseStellarWalletPaymentsInput = {
  network: string | null | undefined;
  currency: string | null | undefined;
  address: string | null | undefined;
  limit?: number;
};

function isValidStellarWalletAddress(address: string | null | undefined): address is string {
  const value = String(address ?? "")
    .trim()
    .toUpperCase();
  return Boolean(value) && StrKey.isValidEd25519PublicKey(value);
}

export function useStellarWalletPayments(
  input: UseStellarWalletPaymentsInput,
) {
  const network = String(input.network ?? "").trim();
  const currency = String(input.currency ?? "").trim();
  const address = String(input.address ?? "")
    .trim()
    .toUpperCase();
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit as number)) : 25;
  const enabled =
    isValidStellarWalletAddress(address) &&
    isStellarUsdcRail({
      network,
      currency,
    });

  return useQuery<OnchainWalletPayment[]>({
    queryKey: ["stellar-wallet-payments", network, address],
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        const resolved = resolveStellarNetwork(network);
        return await fetchStellarWalletPayments({
          horizonUrl: resolved.horizonUrl,
          account: address,
          usdcIssuer: resolved.usdcIssuer,
          limit,
        });
      } catch {
        return [];
      }
    },
  });
}
