import { apiEnvelope, type RequestOptions } from "@/lib/apiClient";
import { newIdempotencyKey } from "@/lib/services/orders";
import {
  accountForNetwork,
  formatNetworkLabel,
  isSendableStablecoinAccount,
  networksCompatible,
  toAssetNetwork,
  toPartnerNetwork,
  toUiNetworkKey,
  type FinancialAccount,
} from "@/lib/services/entities";
import {
  coerceStablecoinNetworkKey,
  stablecoinNetworksForAsset,
} from "@/lib/services/depositRampDestination";
import { buildUsdcSendDestChains } from "@/lib/collect/sendDestChains";
import { stellarExplorerTxUrl } from "@/lib/stellar/network";
import { StrKey } from "@stellar/stellar-sdk";

/**
 * Phase 4 stablecoin sends — partner-aligned preview → confirm.
 *
 * Endpoints (Mboka):
 * - `POST /v1/accounts/{account_id}/sends/preview`
 * - `POST /v1/accounts/{account_id}/sends` (Idempotency-Key REQUIRED, 8–64 chars)
 * - `GET /v1/accounts/{account_id}/sends/{send_id}`
 *
 * Stellar USDC: any funded `G…` with a Circle USDC trustline. Mboka validates
 * StrKey destinations; the aggregator submits a Horizon payment from the
 * Element-custodial account secret.
 *
 * USDC dest chips may include Collect EVM networks while the source account
 * remains the Element Stellar USDC home (Aggregator bridges when enabled).
 *
 * See `Mboka-Backend/docs/implementation/PHASE_4.md` and `app/schema/sends.py`.
 */

export const SEND_STABLECOIN_NETWORKS = [
  { key: "base", label: "Base" },
  { key: "polygon", label: "Polygon" },
  { key: "ethereum", label: "Ethereum" },
  { key: "optimism", label: "Optimism" },
  { key: "arbitrum", label: "Arbitrum" },
  { key: "stellar", label: "Stellar" },
] as const;

export type SendStablecoinNetworkKey = (typeof SEND_STABLECOIN_NETWORKS)[number]["key"];

export type SendStablecoinNetworkOption = {
  key: string;
  label: string;
};

/** Ready Element Stellar USDC home used as the Send source for USDC. */
export function stellarUsdcHomeAccount(
  accounts: FinancialAccount[],
): FinancialAccount | null {
  return (
    accounts.find(
      (account) =>
        isSendableStablecoinAccount(account) &&
        account.currency.trim().toUpperCase() === "USDC" &&
        toPartnerNetwork(account.network) === "Stellar",
    ) || null
  );
}

/** Dedupe sendable accounts from dedicated fetch + bootstrap/list. */
export function mergeSendableAccounts(
  ...lists: Array<FinancialAccount[] | null | undefined>
): FinancialAccount[] {
  const found: FinancialAccount[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const account of list ?? []) {
      if (!isSendableStablecoinAccount(account) || seen.has(account.id)) continue;
      seen.add(account.id);
      found.push(account);
    }
  }
  return found;
}

/** Asset chips the user can actually send from (backend-ready wallets). */
export function sendableAssetsFromAccounts(
  accounts: FinancialAccount[],
): Array<"usdc" | "usdt"> {
  const have = new Set<string>();
  for (const account of accounts) {
    const currency = account.currency.trim().toLowerCase();
    if (currency === "usdc" || currency === "usdt") have.add(currency);
  }
  return (["usdc", "usdt"] as const).filter((key) => have.has(key));
}

/**
 * Dest chain chips for the selected asset.
 * USDC + Stellar home: Aggregator Collect dests + Stellar (source stays Stellar).
 * Otherwise: only rails the user can send from (same-chain).
 */
export function sendableChainsForAsset(
  accounts: FinancialAccount[],
  asset: string | null | undefined,
  opts: {
    accountsReady?: boolean;
    supportedChainKeys?: string[] | null;
  } = {},
): SendStablecoinNetworkOption[] {
  const currency = (asset || "usdc").trim().toUpperCase() || "USDC";
  if (currency === "USDC" && stellarUsdcHomeAccount(accounts)) {
    return buildUsdcSendDestChains({
      supportedChainKeys: opts.supportedChainKeys,
    });
  }

  const catalog = stablecoinNetworksForAsset(SEND_STABLECOIN_NETWORKS, asset).map((n) => ({
    key: n.key,
    label: n.label,
  }));
  const fromAccounts = catalog.filter((network) =>
    accounts.some(
      (account) =>
        account.currency.trim().toUpperCase() === currency &&
        networksCompatible(account.network, network.key),
    ),
  );
  if (fromAccounts.length > 0) return fromAccounts;
  if (opts.accountsReady) return [];
  return catalog;
}

/** Pick a coherent asset + dest chain + source account id from live wallets. */
export function resolveSendStablecoinSelection(input: {
  accounts: FinancialAccount[];
  asset?: string | null;
  chain?: string | null;
  preferredAccountId?: string | null;
  accountsReady?: boolean;
  supportedChainKeys?: string[] | null;
}): {
  asset: string;
  chain: string;
  accountId: string;
  chainLabel: string;
} {
  const accounts = input.accounts;
  const assets = sendableAssetsFromAccounts(accounts);
  const requestedAsset = coerceAssetFallback(input.asset);
  const asset =
    assets.length === 0
      ? requestedAsset
      : assets.includes(requestedAsset as "usdc" | "usdt")
        ? requestedAsset
        : assets[0]!;

  const chains = sendableChainsForAsset(accounts, asset, {
    accountsReady: input.accountsReady,
    supportedChainKeys: input.supportedChainKeys,
  });
  let chain = coerceStablecoinNetworkKey(input.chain, asset, SEND_STABLECOIN_NETWORKS);
  if (chains.length && !chains.some((c) => c.key === chain)) {
    chain = chains[0]!.key;
  }

  const stellarHome =
    asset.toUpperCase() === "USDC" ? stellarUsdcHomeAccount(accounts) : null;
  if (stellarHome) {
    return {
      asset,
      chain,
      accountId: stellarHome.id,
      chainLabel:
        chains.find((c) => c.key === chain)?.label || formatNetworkLabel(chain),
    };
  }

  const preferredId = (input.preferredAccountId || "").trim();
  const preferred =
    (preferredId &&
      accounts.find(
        (account) =>
          account.id === preferredId &&
          account.currency.trim().toUpperCase() === asset.toUpperCase() &&
          networksCompatible(account.network, chain),
      )) ||
    null;
  const account =
    preferred || accountForNetwork(accounts, chain, asset.toUpperCase()) || null;

  return {
    asset,
    chain: account ? toUiNetworkKey(account.network) || chain : chain,
    accountId: account?.id || "",
    chainLabel:
      chains.find((c) => c.key === chain)?.label ||
      formatNetworkLabel(account?.network || chain),
  };
}

function coerceAssetFallback(asset: string | null | undefined): string {
  const raw = (asset || "usdc").trim().toLowerCase();
  return raw === "usdt" ? "usdt" : "usdc";
}

export type AccountSend = {
  id: string;
  status: string;
  account_id: string;
  currency: string;
  network: string;
  to_address: string;
  amount: string;
  fee_amount: string | null;
  receive_amount: string | null;
  preview_token: string | null;
  provider_send_id: string | null;
  /** On-chain hash when the partner has submitted the transfer. */
  tx_hash?: string | null;
  ledger_journal_reference: string | null;
  expires_at: string | null;
};

export type AccountSendPreviewIn = {
  to_address: string;
  amount: string;
  network?: string;
};

export type AccountSendConfirmIn = {
  preview_token: string;
};

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
/** Stellar account StrKey: G + 55 Crockford base32 chars (56 total). */
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const MIN_AMOUNT = 1;

function idempotencyHeaders(key: string): RequestOptions {
  return { headers: { "Idempotency-Key": key } };
}

export function validateEvmAddress(address: string): string {
  const value = address.trim();
  if (!EVM_ADDRESS_RE.test(value)) {
    throw new Error("Enter a valid 0x EVM wallet address (40 hex chars).");
  }
  return value;
}

export function validateStellarAddress(address: string): string {
  const value = address.trim().toUpperCase();
  if (!STELLAR_ADDRESS_RE.test(value) || !StrKey.isValidEd25519PublicKey(value)) {
    throw new Error("Enter a valid Stellar public key (G followed by 55 characters).");
  }
  return value;
}

export function validateSendAddress(address: string, networkKey: string): string {
  const network = toPartnerNetwork(networkKey);
  if (network === "Stellar") return validateStellarAddress(address);
  if (
    network === "Base" ||
    network === "Polygon" ||
    network === "Ethereum" ||
    network === "Optimism" ||
    network === "Arbitrum"
  ) {
    return validateEvmAddress(address);
  }
  throw new Error("Sends support Base, Polygon, Ethereum, Optimism, Arbitrum, and Stellar.");
}

/** Min 1.00 per Phase 4 / partner contract (USDC or USDT). */
export function validateSendAmount(amount: string, currency = "USDC"): string {
  const trimmed = amount.trim().replace(/,/g, "");
  const n = Number(trimmed);
  const label = (currency || "USDC").trim().toUpperCase() || "USDC";
  if (!Number.isFinite(n) || n < MIN_AMOUNT) {
    throw new Error(`Minimum send amount is ${MIN_AMOUNT.toFixed(2)} ${label}.`);
  }
  // Keep a plain decimal string for the backend Decimal field.
  return trimmed;
}

export function buildSendPreviewPayload(params: {
  toAddress: string;
  amount: string;
  networkKey: string;
  /** Account's API network so stellar_testnet is not rewritten as Stellar. */
  accountNetwork?: string;
  /** Display currency for min-amount errors (USDC / USDT). */
  currency?: string;
}): AccountSendPreviewIn {
  const destPartner = toPartnerNetwork(params.networkKey);
  if (!destPartner) {
    throw new Error("Sends support Base, Polygon, Ethereum, Optimism, Arbitrum, and Stellar.");
  }
  // Dest network drives the partner call. Preserve stellar_testnet/public only when
  // the destination is Stellar (same-chain home payment).
  const network =
    destPartner === "Stellar" && params.accountNetwork
      ? toAssetNetwork(params.accountNetwork)
      : toAssetNetwork(params.networkKey);
  return {
    to_address: validateSendAddress(params.toAddress, params.networkKey),
    amount: validateSendAmount(params.amount, params.currency),
    network,
  };
}

export function sendCryptoRecipientPlaceholder(networkKey: string): string {
  return toPartnerNetwork(networkKey) === "Stellar"
    ? "G… (Stellar public key)"
    : "0x… (EVM address)";
}

/** Display USDC amounts with two decimal places (API may return 18-scale decimals). */
export function formatSendAmountDisplay(amount: string | null | undefined): string {
  const raw = String(amount ?? "").trim().replace(/,/g, "");
  if (!raw) return "0.00";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Human status label for the send success summary. */
export function formatSendStatusDisplay(status: string | null | undefined): string {
  const raw = String(status ?? "").trim();
  if (!raw) return "submitted";
  return raw.replace(/_/g, " ");
}

/**
 * Public explorer URL for a confirmed account-send tx hash.
 * Returns null when the hash/network cannot be linked.
 */
export function buildSendExplorerUrl(opts: {
  network: string | null | undefined;
  txHash: string | null | undefined;
}): string | null {
  const hash = String(opts.txHash ?? "").trim();
  if (!hash) return null;
  const network = toPartnerNetwork(opts.network) || String(opts.network ?? "").trim();
  const key = String(opts.network ?? "").trim().toLowerCase();

  if (network === "Stellar" || key.includes("stellar")) {
    return stellarExplorerTxUrl({ txHash: hash, network: opts.network });
  }
  if (network === "Base" || key.includes("base")) {
    return `https://basescan.org/tx/${encodeURIComponent(hash)}`;
  }
  if (network === "Polygon" || key.includes("polygon")) {
    return `https://polygonscan.com/tx/${encodeURIComponent(hash)}`;
  }
  if (network === "Ethereum" || key === "ethereum" || key === "eth") {
    return `https://etherscan.io/tx/${encodeURIComponent(hash)}`;
  }
  if (network === "Optimism" || key.includes("optimism")) {
    return `https://optimistic.etherscan.io/tx/${encodeURIComponent(hash)}`;
  }
  if (network === "Arbitrum" || key.includes("arbitrum")) {
    return `https://arbiscan.io/tx/${encodeURIComponent(hash)}`;
  }
  return null;
}

export function buildAccountSendResultSummary(send: {
  amount?: string | null;
  currency?: string | null;
  status?: string | null;
  id?: string | null;
}): string {
  const amount = formatSendAmountDisplay(send.amount);
  const currency = String(send.currency || "USDC").trim().toUpperCase() || "USDC";
  const status = formatSendStatusDisplay(send.status);
  const id = String(send.id || "").trim();
  return id ? `${amount} ${currency} · ${status} · ${id}` : `${amount} ${currency} · ${status}`;
}

export type AccountSendSuccessDetails = {
  title: string;
  amountDisplay: string;
  currency: string;
  statusLabel: string;
  referenceId: string | null;
  networkLabel: string | null;
  explorerLabel: string;
};

/** Title copy matched to send lifecycle (avoid “on its way” when already completed). */
export function buildSendSuccessTitle(status: string | null | undefined): string {
  const key = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (key === "completed" || key === "settled" || key === "success" || key === "succeeded") {
    return "Transfer complete";
  }
  if (key === "failed" || key === "canceled" || key === "cancelled" || key === "rejected") {
    return "Transfer failed";
  }
  return "Payment on its way";
}

/** Human label for the explorer CTA. */
export function buildSendExplorerLabel(network: string | null | undefined): string {
  const partner = toPartnerNetwork(network) || String(network ?? "").trim();
  const key = String(network ?? "").trim().toLowerCase();
  if (partner === "Stellar" || key.includes("stellar")) return "View on Stellar";
  if (partner === "Base" || key.includes("base")) return "View on Basescan";
  if (partner === "Polygon" || key.includes("polygon")) return "View on Polygonscan";
  if (partner === "Ethereum" || key === "ethereum" || key === "eth") return "View on Etherscan";
  if (partner === "Optimism" || key.includes("optimism")) return "View on Optimism";
  if (partner === "Arbitrum" || key.includes("arbitrum")) return "View on Arbiscan";
  return "View onchain";
}

/** Structured fields for the send-success receipt UI. */
export function buildAccountSendSuccessDetails(send: {
  amount?: string | null;
  currency?: string | null;
  status?: string | null;
  id?: string | null;
  network?: string | null;
}): AccountSendSuccessDetails {
  const currency = String(send.currency || "USDC").trim().toUpperCase() || "USDC";
  const statusRaw = formatSendStatusDisplay(send.status);
  const statusLabel = statusRaw
    ? statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1)
    : "Submitted";
  const network =
    toPartnerNetwork(send.network) || String(send.network ?? "").trim() || null;
  return {
    title: buildSendSuccessTitle(send.status),
    amountDisplay: formatSendAmountDisplay(send.amount),
    currency,
    statusLabel,
    referenceId: String(send.id || "").trim() || null,
    networkLabel: network,
    explorerLabel: buildSendExplorerLabel(send.network),
  };
}

/** Keep legacy EVM-only rejection copy readable if an older API is still live. */
export function explainAccountSendError(message: string, networkKey: string): string {
  if (toPartnerNetwork(networkKey) !== "Stellar") return message;
  if (/20-byte EVM|0x EVM|must be Base or Polygon$/i.test(message)) {
    return "Stellar USDC sends need a backend that accepts G… destinations. Retry after the send API is updated, or contact support.";
  }
  return message;
}

export const accountSendsApi = {
  preview: (accountId: string, payload: AccountSendPreviewIn) =>
    apiEnvelope<AccountSend>(
      "POST",
      `/v1/accounts/${encodeURIComponent(accountId)}/sends/preview`,
      payload,
    ),

  /**
   * Confirm a previewed send. `idempotencyKey` is REQUIRED by the backend
   * (ValidationError if missing) and must be 8–64 characters.
   */
  confirm: (accountId: string, payload: AccountSendConfirmIn, idempotencyKey: string) =>
    apiEnvelope<AccountSend>(
      "POST",
      `/v1/accounts/${encodeURIComponent(accountId)}/sends`,
      payload,
      idempotencyHeaders(idempotencyKey),
    ),

  get: (accountId: string, sendId: string) =>
    apiEnvelope<AccountSend>(
      "GET",
      `/v1/accounts/${encodeURIComponent(accountId)}/sends/${encodeURIComponent(sendId)}`,
    ),
};

export { newIdempotencyKey };
