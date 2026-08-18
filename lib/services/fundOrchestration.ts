/**
 * Best-effort funding orchestration helpers.
 *
 * Partner docs (deposit-accounts/overview): do **not** mix African OnRamp with
 * entity deposit accounts in one checkout. This module still composes them
 * sequentially for product experiments — callers must treat convert failures
 * as expected until ledger FX rails are confirmed for the entity.
 */

/** Fiat deposit currencies the African auto-fund path may target. */
export const AFRICAN_FUND_FIAT_CURRENCIES = ["EUR", "USD", "GBP"] as const;

function isUsdcTarget(currency: string): boolean {
  return currency.trim().toUpperCase() === "USDC";
}

function isAfricanFundFiat(fiat: string): boolean {
  return (AFRICAN_FUND_FIAT_CURRENCIES as readonly string[]).includes(fiat);
}

export type LedgerConvertQuoteIn = {
  order_type: "OffRamp";
  currency: string;
  crypto_amount: number | string;
  asset: { currency: "USDC" | "USDT" };
  payment_method: {
    type: "bank";
    network_id: string;
    entity_id: number | string;
    account_id: number | string;
    destination_account_id: number | string;
  };
};

export type FundOrchestrationInputs = {
  fiatCurrency: string;
  fiatAccountId: string | null | undefined;
  entityId: string | null | undefined;
  usdcAccountId: string | null | undefined;
  usdcWalletAddress: string | null | undefined;
  treasuryWalletAddress: string | null | undefined;
  /** Ledger FX rail from catalog discovery; required for auto-convert. */
  convertNetworkId: string | null | undefined;
};

export type FundOrchestrationPlan = {
  canRunAfricanOnRamp: boolean;
  onRampWalletAddress: string | null;
  onRampWalletSource: "usdc_deposit" | "treasury" | null;
  canAttemptAutoConvert: boolean;
  blockers: string[];
};

/** Prefer the entity USDC deposit wallet so OnRamp credit lands on the convert rail. */
export function resolveOnRampWalletAddress(input: {
  usdcWalletAddress?: string | null;
  treasuryWalletAddress?: string | null;
}): { address: string | null; source: "usdc_deposit" | "treasury" | null } {
  const usdc = input.usdcWalletAddress?.trim() || null;
  if (usdc) return { address: usdc, source: "usdc_deposit" };
  const treasury = input.treasuryWalletAddress?.trim() || null;
  if (treasury) return { address: treasury, source: "treasury" };
  return { address: null, source: null };
}

export function planAfricanFundOrchestration(
  input: FundOrchestrationInputs,
): FundOrchestrationPlan {
  const blockers: string[] = [];
  const fiat = input.fiatCurrency.trim().toUpperCase();
  const usdcTarget = isUsdcTarget(fiat);
  if (!usdcTarget && !isAfricanFundFiat(fiat)) {
    blockers.push(
      `Auto-fund only targets ${AFRICAN_FUND_FIAT_CURRENCIES.join(" / ")} deposit accounts or USDC (got ${fiat || "—"}).`,
    );
  }

  const wallet = resolveOnRampWalletAddress({
    usdcWalletAddress: input.usdcWalletAddress,
    treasuryWalletAddress: input.treasuryWalletAddress,
  });
  if (!wallet.address) {
    blockers.push("No USDC deposit wallet or treasury wallet to receive the OnRamp.");
  } else if (wallet.source === "treasury") {
    blockers.push(
      "OnRamp will credit the treasury wallet — ledger convert needs USDC on the entity deposit account. Open a USDC account first for higher auto-convert odds.",
    );
  }

  const canRunAfricanOnRamp = Boolean(wallet.address) && (usdcTarget || isAfricanFundFiat(fiat));

  const missingConvert: string[] = [];
  if (!usdcTarget) {
    if (!input.entityId) missingConvert.push("entity");
    if (!input.usdcAccountId) missingConvert.push("USDC account");
    if (!input.fiatAccountId) missingConvert.push(`${fiat} account`);
    if (!input.convertNetworkId?.trim()) missingConvert.push("ledger FX network_id");
    if (missingConvert.length) {
      blockers.push(`Auto-convert needs: ${missingConvert.join(", ")}.`);
    }
  }

  const canAttemptAutoConvert =
    canRunAfricanOnRamp &&
    !usdcTarget &&
    Boolean(input.entityId && input.usdcAccountId && input.fiatAccountId && input.convertNetworkId?.trim()) &&
    wallet.source === "usdc_deposit";

  return {
    canRunAfricanOnRamp,
    onRampWalletAddress: wallet.address,
    onRampWalletSource: wallet.source,
    canAttemptAutoConvert,
    blockers,
  };
}

/**
 * Partner-shaped OffRamp ledger convert (USDC → fiat deposit account).
 * B2B `/v1/orders/quote` may reject this until the BFF supports entity FX —
 * treat failures as soft.
 */
export function buildLedgerConvertQuotePayload(input: {
  fiatCurrency: string;
  cryptoAmount: string | number;
  networkId: string;
  entityId: string | number;
  usdcAccountId: string | number;
  fiatAccountId: string | number;
  assetCurrency?: "USDC" | "USDT";
}): LedgerConvertQuoteIn {
  const crypto =
    typeof input.cryptoAmount === "number"
      ? input.cryptoAmount
      : Number.parseFloat(String(input.cryptoAmount).trim());
  if (!Number.isFinite(crypto) || crypto <= 0) {
    throw new Error("Convert amount must be a positive number.");
  }
  const networkId = input.networkId.trim();
  if (!networkId) throw new Error("Ledger FX network_id is required for auto-convert.");

  return {
    order_type: "OffRamp",
    currency: input.fiatCurrency.trim().toUpperCase(),
    crypto_amount: crypto,
    asset: { currency: input.assetCurrency ?? "USDC" },
    payment_method: {
      type: "bank",
      network_id: networkId,
      entity_id: input.entityId,
      account_id: input.usdcAccountId,
      destination_account_id: input.fiatAccountId,
    },
  };
}

export function africanFundDisabledReason(plan: FundOrchestrationPlan): string | undefined {
  if (plan.canRunAfricanOnRamp) return undefined;
  return plan.blockers[0] || "African OnRamp path is unavailable for this account.";
}
