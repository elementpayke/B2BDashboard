/**
 * Simulation adapter for the managed Stellar USDC Account.
 *
 * There is no live Stellar contract wired to this dashboard yet. Everything
 * here is fixture-backed and deliberately quarantined so it can be deleted in
 * one piece: nothing in this module reads real API data, and nothing real
 * reads from it. In particular the simulated balance is never folded into the
 * dashboard's own totals — see `isSimulated` on the account, which the UI uses
 * to badge the surface as demo data.
 *
 * The function signatures are shaped like the endpoints that will replace
 * them, so the swap is a change of implementation rather than of callers:
 *
 *   listStellarAccounts   → GET  /v1/stellar/accounts
 *   connectStellarWallet  → POST /v1/stellar/deposits/wallet/connect
 *   previewStellarDeposit → POST /v1/stellar/deposits/preview
 *   submitStellarDeposit  → POST /v1/stellar/deposits/submit
 *   getStellarDeposit     → GET  /v1/stellar/deposits/{id}
 *
 * Product line: this is an enterprise payments account that happens to settle
 * on Stellar. Trustlines, reserves, keys and gas are the platform's problem,
 * never the user's — the vocabulary here stays at "deposit / pending /
 * credited / needs review".
 */

/** Shown wherever simulated figures appear, so no one mistakes them for real. */
export const STELLAR_DEMO_LABEL = "Demo data";

export const STELLAR_ASSET = "USDC" as const;
export const STELLAR_NETWORK = "Stellar" as const;

/* ─────────────────────────── account ─────────────────────────── */

/**
 * Operational states for the managed account. These are account-level and
 * deliberately separate from `TransactionStatus` (the backend's order
 * vocabulary) — mixing them would put simulated values into the type that
 * models real API responses.
 */
export type StellarAccountStatus =
  | "available"
  | "pending_deposit"
  | "processing_payout"
  | "review_required"
  | "failed";

export type StellarStatusDescriptor = {
  label: string;
  icon: string;
  color: string;
  soft: string;
};

export const STELLAR_ACCOUNT_STATUS: Record<StellarAccountStatus, StellarStatusDescriptor> = {
  available: {
    label: "Available",
    icon: "●",
    color: "var(--success)",
    soft: "color-mix(in srgb, var(--success) 10%, transparent)",
  },
  pending_deposit: {
    label: "Pending deposit",
    icon: "◔",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
  },
  processing_payout: {
    label: "Processing payout",
    icon: "◔",
    color: "var(--indigo-text)",
    soft: "var(--indigo-tint)",
  },
  review_required: {
    label: "Review required",
    icon: "!",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
  },
  failed: {
    label: "Failed",
    icon: "!",
    color: "var(--red)",
    soft: "var(--red-tint)",
  },
};

export function describeStellarStatus(status: StellarAccountStatus): StellarStatusDescriptor {
  return STELLAR_ACCOUNT_STATUS[status];
}

export type StellarManagedAccount = {
  id: string;
  /** Product name. Never "wallet" in primary UI. */
  name: string;
  asset: typeof STELLAR_ASSET;
  network: typeof STELLAR_NETWORK;
  status: StellarAccountStatus;
  availableBalance: string;
  pendingBalance: string;
  /** Mboka's receiving address for external deposits. */
  receivingAddress: string;
  /** Required on every inbound transfer — funds without it go to review. */
  depositMemo: string;
  /** Always true here. Guards against this ever being rendered as real. */
  isSimulated: true;
};

const MANAGED_ACCOUNT: StellarManagedAccount = {
  id: "stellar-usdc-managed",
  name: "USDC Account",
  asset: STELLAR_ASSET,
  network: STELLAR_NETWORK,
  status: "available",
  availableBalance: "142860.00",
  pendingBalance: "18400.00",
  receivingAddress: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
  depositMemo: "MBOKA-4821",
  isSimulated: true,
};

/* ─────────────────────────── activity ─────────────────────────── */

export type StellarActivityStatus = StellarAccountStatus | "settled";

export type StellarActivity = {
  id: string;
  title: string;
  subtitle: string;
  /** Signed, already formatted for display. */
  amount: string;
  direction: "in" | "out";
  status: StellarActivityStatus;
  createdAt: string;
  /** Present once the transfer has a Stellar transaction. */
  txHash: string | null;
  memo: string | null;
  asset: typeof STELLAR_ASSET;
  network: typeof STELLAR_NETWORK;
};

const ACTIVITY: StellarActivity[] = [
  {
    id: "stx-1",
    title: "External wallet deposit",
    subtitle: "USDC Account funding",
    amount: "+18,400.00",
    direction: "in",
    status: "pending_deposit",
    createdAt: "2026-08-14T09:41:00Z",
    txHash: null,
    memo: "MBOKA-4821",
    asset: STELLAR_ASSET,
    network: STELLAR_NETWORK,
  },
  {
    id: "stx-2",
    title: "External wallet deposit",
    subtitle: "USDC Account funding",
    amount: "+65,000.00",
    direction: "in",
    status: "settled",
    createdAt: "2026-08-13T16:12:00Z",
    txHash: "3f1a9c47d2b85e60a1c4f8d93e27b5061a8c4f2d9e73b16a5c08d4f291e6b73a",
    memo: "MBOKA-4821",
    asset: STELLAR_ASSET,
    network: STELLAR_NETWORK,
  },
  {
    id: "stx-3",
    title: "M-Pesa funding",
    subtitle: "USDC Account funding",
    amount: "+12,500.00",
    direction: "in",
    status: "settled",
    createdAt: "2026-08-12T11:05:00Z",
    txHash: "9b74e2c1f08a5d36b2e91c47a0f8d5273c6b1e94a2f70d85c3b19e6f4a2d7c05",
    memo: "MBOKA-4821",
    asset: STELLAR_ASSET,
    network: STELLAR_NETWORK,
  },
  {
    id: "stx-4",
    title: "Supplier payout · Lagos",
    subtitle: "USDC Account payout",
    amount: "-8,200.00",
    direction: "out",
    status: "processing_payout",
    createdAt: "2026-08-11T14:38:00Z",
    txHash: null,
    memo: "MBOKA-4821",
    asset: STELLAR_ASSET,
    network: STELLAR_NETWORK,
  },
  {
    id: "stx-5",
    title: "External wallet deposit",
    subtitle: "USDC Account funding",
    amount: "+4,000.00",
    direction: "in",
    status: "review_required",
    // Arrived without a matching memo, so it cannot be auto-credited.
    createdAt: "2026-08-10T08:22:00Z",
    txHash: "c2e58a9147d3b06f5a1e8c4293b7d05f6a3c19e847b25d0f9c6a3e148b70d592",
    memo: null,
    asset: STELLAR_ASSET,
    network: STELLAR_NETWORK,
  },
];

/* ────────────────────── external wallet deposit ────────────────────── */

export type StellarWallet = { id: string; name: string; hint: string };

export const STELLAR_WALLETS: StellarWallet[] = [
  { id: "freighter", name: "Freighter", hint: "Browser extension" },
  { id: "lobstr", name: "LOBSTR", hint: "Mobile · WalletConnect" },
  { id: "albedo", name: "Albedo", hint: "Web signer" },
  { id: "rabet", name: "Rabet", hint: "Browser extension" },
];

/**
 * Which outcome the simulation should play. Exposed in the UI behind a clearly
 * marked demo control so the failure paths can be exercised without a backend.
 */
export type StellarScenario =
  | "happy"
  | "connection_rejected"
  | "no_trustline"
  | "payment_rejected"
  | "pending_too_long"
  | "memo_mismatch";

export const STELLAR_SCENARIOS: { id: StellarScenario; label: string }[] = [
  { id: "happy", label: "Happy path" },
  { id: "connection_rejected", label: "Connection rejected" },
  { id: "no_trustline", label: "No USDC trustline" },
  { id: "payment_rejected", label: "Payment rejected" },
  { id: "pending_too_long", label: "Pending too long" },
  { id: "memo_mismatch", label: "Memo mismatch" },
];

export type StellarDepositStage =
  | "connect"
  | "preflight"
  | "review"
  | "approving"
  | "pending"
  | "credited"
  | "failed";

export type StellarDepositState = {
  id: string;
  stage: StellarDepositStage;
  walletId: string | null;
  walletName: string | null;
  /** The connected external wallet's address, not Mboka's. */
  walletAddress: string | null;
  trustlineReady: boolean;
  amount: string;
  memo: string;
  destination: string;
  txHash: string | null;
  /** Set on any failed/needs-review outcome. Plain language, never a code. */
  error: string | null;
  /** True when the failure is "we need a human", not "this went wrong". */
  needsReview: boolean;
  scenario: StellarScenario;
};

export class StellarSimulationError extends Error {
  readonly needsReview: boolean;

  constructor(message: string, needsReview = false) {
    super(message);
    this.name = "StellarSimulationError";
    this.needsReview = needsReview;
  }
}

export function initialDepositState(scenario: StellarScenario = "happy"): StellarDepositState {
  return {
    id: "sdep-simulated",
    stage: "connect",
    walletId: null,
    walletName: null,
    walletAddress: null,
    trustlineReady: false,
    amount: "",
    memo: MANAGED_ACCOUNT.depositMemo,
    destination: MANAGED_ACCOUNT.receivingAddress,
    txHash: null,
    error: null,
    needsReview: false,
    scenario,
  };
}

/* ───────────────────────── presentation ───────────────────────── */

/** Stellar public keys are base32, start with G, and are 56 characters. */
export function isValidStellarAddress(value: string | null | undefined): boolean {
  return /^G[A-Z2-7]{55}$/.test((value ?? "").trim());
}

/**
 * Middle-truncated address for dense rows. Full value belongs in a copy
 * control and a `title`, never only in truncated form.
 */
export function formatStellarAddress(value: string | null | undefined, visible = 6): string {
  const address = (value ?? "").trim();
  if (!address) return "—";
  if (address.length <= visible * 2 + 1) return address;
  return `${address.slice(0, visible)}…${address.slice(-visible)}`;
}

/** Transaction hashes are 64 hex characters; same truncation treatment. */
export function formatStellarTxHash(value: string | null | undefined, visible = 8): string {
  const hash = (value ?? "").trim();
  if (!hash) return "—";
  if (hash.length <= visible * 2 + 1) return hash;
  return `${hash.slice(0, visible)}…${hash.slice(-visible)}`;
}

/**
 * A deposit without the reference cannot be matched to an account
 * automatically, which is why the UI warns about it rather than treating the
 * memo as optional metadata.
 */
export function describeMemoRequirement(memo: string | null | undefined): string {
  const value = (memo ?? "").trim();
  if (!value) return "A payment reference is required — transfers without one are held for review.";
  return `Include the reference ${value} — transfers without it are held for review.`;
}

/** Explorer links only make sense once there is a transaction to look at. */
export function stellarExplorerUrl(txHash: string | null | undefined): string | null {
  const hash = (txHash ?? "").trim();
  if (!/^[0-9a-f]{64}$/i.test(hash)) return null;
  return `https://stellar.expert/explorer/public/tx/${hash}`;
}

/* ───────────────────────── the adapter ───────────────────────── */

let latencyMs = 620;

/**
 * Test seam. The delay exists so the UI's loading states are real rather than
 * instantaneous; tests set it to 0 so they aren't paying for it.
 */
export function setStellarSimulationLatency(ms: number): void {
  latencyMs = Math.max(0, ms);
}

function delay<T>(value: T, ms = latencyMs): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function fail(message: string, ms = latencyMs, needsReview = false): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new StellarSimulationError(message, needsReview)), ms),
  );
}

/** Deterministic pseudo-hash so a simulated run looks plausible and is stable. */
function simulatedTxHash(seed: string): string {
  let h = 0x811c9dc5;
  const out: string[] = [];
  for (let i = 0; i < 64; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 0x01000193) >>> 0;
    out.push((h % 16).toString(16));
  }
  return out.join("");
}

/** GET /v1/stellar/accounts */
export async function listStellarAccounts(): Promise<StellarManagedAccount[]> {
  return delay([MANAGED_ACCOUNT]);
}

/** GET /v1/stellar/accounts/{id}/activity */
export async function listStellarActivity(): Promise<StellarActivity[]> {
  return delay(ACTIVITY);
}

/** POST /v1/stellar/deposits/wallet/connect */
export async function connectStellarWallet(
  state: StellarDepositState,
  walletId: string,
): Promise<StellarDepositState> {
  const wallet = STELLAR_WALLETS.find((w) => w.id === walletId);
  if (!wallet) throw new StellarSimulationError("That wallet isn't supported yet.");

  if (state.scenario === "connection_rejected") {
    return fail("Connection request was rejected in your wallet. Try again to continue.");
  }

  const trustlineReady = state.scenario !== "no_trustline";
  return delay({
    ...state,
    stage: "preflight" as const,
    walletId: wallet.id,
    walletName: wallet.name,
    walletAddress: "GBQ4NLZ6TWJXK2YCVMHR5DPFA3EOSU7IWG5LKX7BTDMYVQZH6RNC2FJS",
    trustlineReady,
    error: trustlineReady
      ? null
      : "This wallet can't hold USDC yet. Add USDC in your wallet, then reconnect.",
  });
}

/** POST /v1/stellar/deposits/preview */
export async function previewStellarDeposit(
  state: StellarDepositState,
  amount: string,
): Promise<StellarDepositState> {
  if (!state.trustlineReady) {
    return fail("This wallet can't hold USDC yet. Add USDC in your wallet, then reconnect.");
  }
  const parsed = Number((amount || "").replace(/[\s,]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fail("Enter a deposit amount greater than zero.", Math.min(latencyMs, 120));
  }
  return delay({ ...state, stage: "review" as const, amount, error: null });
}

/** POST /v1/stellar/deposits/submit — the wallet-approval step. */
export async function submitStellarDeposit(
  state: StellarDepositState,
): Promise<StellarDepositState> {
  if (state.scenario === "payment_rejected") {
    return fail("You rejected the payment in your wallet. Nothing was sent.");
  }
  return delay({
    ...state,
    stage: "pending" as const,
    txHash: simulatedTxHash(`${state.id}:${state.amount}`),
    error: null,
  });
}

/**
 * GET /v1/stellar/deposits/{id} — the confirmation poll.
 *
 * The two non-happy outcomes here are the ones that matter operationally: a
 * transfer that hasn't confirmed yet is still fine and just needs patience,
 * whereas one that arrived without a matching memo needs a human and must not
 * be presented as a failure the user caused.
 */
export async function getStellarDeposit(
  state: StellarDepositState,
): Promise<StellarDepositState> {
  if (state.scenario === "pending_too_long") {
    return delay({
      ...state,
      stage: "pending" as const,
      error:
        "Still waiting for confirmation. Stellar transfers usually settle in seconds — we'll credit this automatically once it lands.",
    });
  }
  if (state.scenario === "memo_mismatch") {
    return delay({
      ...state,
      stage: "failed" as const,
      needsReview: true,
      error:
        "This transfer arrived without a matching reference, so we've held it for review. Our team will credit it shortly — no action needed from you.",
    });
  }
  return delay({ ...state, stage: "credited" as const, error: null, needsReview: false });
}
