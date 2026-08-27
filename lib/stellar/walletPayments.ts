type PaymentDirection = "in" | "out";

export type OnchainWalletPayment = {
  txHash: string;
  amount: string;
  direction: PaymentDirection;
  from: string;
  to: string;
  memo: string | null;
  createdAt: string;
  pagingToken: string;
};

type ParseOptions = {
  account: string;
  usdcIssuer: string;
};

const HORIZON_PAYMENT_TYPES = new Set([
  "payment",
  "path_payment_strict_receive",
  "path_payment_strict_send",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function positiveAmount(value: unknown): string | null {
  const raw = optionalString(value);
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? raw : null;
}

function normalizeAddress(value: unknown): string | null {
  const raw = optionalString(value);
  return raw ? raw.toUpperCase() : null;
}

function paymentDirection(opts: {
  account: string;
  from: string | null;
  to: string | null;
}): PaymentDirection | null {
  if (opts.to === opts.account && opts.from !== opts.account) return "in";
  if (opts.from === opts.account) return "out";
  return null;
}

export function parseHorizonPaymentRecord(
  record: unknown,
  options: ParseOptions,
): OnchainWalletPayment | null {
  const row = asRecord(record);
  if (!row) return null;

  const type = optionalString(row.type)?.toLowerCase();
  if (!type || !HORIZON_PAYMENT_TYPES.has(type)) return null;
  if (row.transaction_successful === false) return null;

  const account = options.account.trim().toUpperCase();
  const from = normalizeAddress(row.from);
  const to = normalizeAddress(row.to);
  const direction = paymentDirection({ account, from, to });
  if (!direction || !from || !to) return null;

  const isPathPayment =
    type === "path_payment_strict_receive" || type === "path_payment_strict_send";
  // Path payments: destination leg is asset_*/amount; source leg is
  // source_asset_*/source_amount. Ordinary payments only expose destination fields.
  const useSourceLeg = isPathPayment && direction === "out";
  const assetCode = optionalString(
    useSourceLeg ? row.source_asset_code : row.asset_code,
  )?.toUpperCase();
  const assetIssuer = normalizeAddress(
    useSourceLeg ? row.source_asset_issuer : row.asset_issuer,
  );
  if (assetCode !== "USDC" || assetIssuer !== options.usdcIssuer.trim().toUpperCase()) {
    return null;
  }

  const amount = positiveAmount(useSourceLeg ? row.source_amount : row.amount);
  const txHash = optionalString(row.transaction_hash);
  const createdAt =
    optionalString(row.created_at) ??
    optionalString(asRecord(row.transaction_attr)?.created_at);
  const pagingToken = optionalString(row.paging_token);
  if (!amount || !txHash || !createdAt || !pagingToken) {
    return null;
  }

  return {
    txHash,
    amount,
    direction,
    from,
    to,
    memo: optionalString(asRecord(row.transaction_attr)?.memo),
    createdAt,
    pagingToken,
  };
}

function extractHorizonRecords(payload: unknown): unknown[] {
  const body = asRecord(payload);
  const embedded = asRecord(body?._embedded);
  return Array.isArray(embedded?.records) ? embedded.records : [];
}

export async function fetchStellarWalletPayments(opts: {
  horizonUrl: string;
  account: string;
  usdcIssuer: string;
  limit?: number;
}): Promise<OnchainWalletPayment[]> {
  const baseUrl = opts.horizonUrl.replace(/\/+$/, "");
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.floor(opts.limit as number)) : 25;
  const account = opts.account.trim().toUpperCase();
  const url =
    `${baseUrl}/accounts/${encodeURIComponent(account)}/payments` +
    `?order=desc&limit=${limit}&join=transactions`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Horizon request failed (${response.status}).`);
  }

  const payload = await response.json();
  return extractHorizonRecords(payload)
    .map((record) =>
      parseHorizonPaymentRecord(record, {
        account,
        usdcIssuer: opts.usdcIssuer,
      }),
    )
    .filter((record): record is OnchainWalletPayment => record !== null);
}
